"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatoPeso } from "@/lib/formato";
import { pdfLiquidacion } from "@/lib/exportar";
import { calcularLiquidacion, type TramoImpuesto } from "@/lib/remuneracion";
import { Perfil, supabase } from "@/lib/supabase";

type Trabajador = { id: string; nombre: string; sueldo_base: number; area: string; modo_gratificacion: "ninguna" | "fija" | "legal"; gratificacion_fija: number; salud: "fonasa" | "isapre"; isapre_uf: number; isapre_pesos: number; afp_nombre: string; colacion: number; colacion_imponible: boolean; movilizacion: number; movilizacion_imponible: boolean };

export default function Liquidacion() {
  const [empresaId, setEmpresaId] = useState("");
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [trabajadorId, setTrabajadorId] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [horasExtra, setHorasExtra] = useState(0);
  const [diasDomingo, setDiasDomingo] = useState(0);
  const [otrosNombre, setOtrosNombre] = useState("");
  const [otrosMonto, setOtrosMonto] = useState(0);
  const [resultado, setResultado] = useState<string[]>([]);
  const [liquido, setLiquido] = useState(0);
  const [detalle, setDetalle] = useState<unknown>(null);
  const [aviso, setAviso] = useState("");
  const [cerrada, setCerrada] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
      const id = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id ?? "";
      setEmpresaId(id);
      const lista = await supabase().from("trabajadores").select("*").eq("empresa_id", id).eq("activo", true).order("nombre");
      setTrabajadores((lista.data ?? []) as Trabajador[]);
    })();
  }, []);

  async function calcular() {
    const trabajador = trabajadores.find((item) => item.id === trabajadorId);
    if (!trabajador) return;
    const [parametros, tramos, afp, bono, guardada] = await Promise.all([
      supabase().from("parametros_anio").select("*").eq("empresa_id", empresaId).eq("anio", anio).maybeSingle(),
      supabase().from("tramos_impuesto").select("desde, hasta, factor, rebaja").eq("empresa_id", empresaId).eq("anio", anio).order("desde"),
      supabase().from("afp_periodo").select("*").eq("empresa_id", empresaId).eq("anio", anio).eq("mes", mes).eq("nombre", trabajador.afp_nombre).maybeSingle(),
      supabase().from("bonos_area").select("monto").eq("empresa_id", empresaId).eq("anio", anio).eq("mes", mes).eq("area", trabajador.area).maybeSingle(),
      supabase().from("liquidaciones").select("estado, detalle, liquido").eq("trabajador_id", trabajadorId).eq("anio", anio).eq("mes", mes).maybeSingle(),
    ]);
    if (guardada.data?.estado === "pagada") {
      setCerrada(true);
      setLiquido(Number(guardada.data.liquido));
      setAviso("Esta liquidación está pagada y no se vuelve a calcular.");
      return;
    }
    if (!parametros.data) { setAviso("Faltan los parámetros de ese año."); return; }
    const p = parametros.data;
    const calculo = calcularLiquidacion({
      sueldoBase: Number(trabajador.sueldo_base),
      modoGratificacion: trabajador.modo_gratificacion,
      gratificacionFija: Number(trabajador.gratificacion_fija),
      horasExtra, diasDomingo,
      bonoArea: Number(bono.data?.monto ?? 0),
      colacion: Number(trabajador.colacion),
      colacionImponible: trabajador.colacion_imponible,
      movilizacion: Number(trabajador.movilizacion),
      movilizacionImponible: trabajador.movilizacion_imponible,
      afpTasa: Number(afp.data?.tasa ?? 0),
      afpComision: Number(afp.data?.comision ?? 0),
      afpSeguro: Number(afp.data?.seguro ?? 0),
      salud: trabajador.salud,
      isapreUf: Number(trabajador.isapre_uf),
      isaprePesos: Number(trabajador.isapre_pesos),
      otrosDescuentos: otrosNombre ? [{ nombre: otrosNombre, monto: otrosMonto }] : [],
      parametros: {
        ingresoMinimo: Number(p.ingreso_minimo), porcentajeGratificacion: Number(p.porcentaje_gratificacion), factorTopeGratificacion: Number(p.factor_tope_gratificacion),
        recargoHoraExtra: Number(p.recargo_hora_extra), recargoDomingo: Number(p.recargo_domingo), horasJornada: Number(p.horas_jornada),
        tasaFonasa: Number(p.tasa_fonasa), tasaCesantia: Number(p.tasa_cesantia), valorUf: Number(p.valor_uf), topeImponible: Number(p.tope_imponible),
      },
      tramos: ((tramos.data ?? []) as TramoImpuesto[]).map((tramo) => ({ ...tramo, desde: Number(tramo.desde), hasta: tramo.hasta === null ? null : Number(tramo.hasta), factor: Number(tramo.factor), rebaja: Number(tramo.rebaja) })),
    });
    if ("error" in calculo) { setAviso(calculo.error); return; }
    setCerrada(false);
    setDetalle(calculo);
    setLiquido(calculo.liquido);
    setResultado([
      ...calculo.haberes.map((item) => `Haber ${item.nombre}: ${formatoPeso(item.monto)}`),
      ...calculo.descuentos.map((item) => `Descuento ${item.nombre}: ${formatoPeso(item.monto)}`),
      `Imponible ${formatoPeso(calculo.imponible)}`,
      `Tributable ${formatoPeso(calculo.tributable)}`,
      `Líquido ${formatoPeso(calculo.liquido)}`,
    ]);
    setAviso("Puede corregir los datos y volver a calcular antes de cerrarla.");
  }

  async function guardar(pagar: boolean) {
    if (!detalle) return;
    const cuerpo = {
      empresa_id: empresaId, trabajador_id: trabajadorId, anio, mes, detalle, imponible: 0, tributable: 0, liquido,
      estado: pagar ? "pagada" : "borrador", fecha_pago: pagar ? new Date().toISOString().slice(0, 10) : null, monto_pagado: pagar ? liquido : null, medio: pagar ? "transferencia" : "",
    };
    const calculado = detalle as { imponible: number; tributable: number };
    cuerpo.imponible = calculado.imponible;
    cuerpo.tributable = calculado.tributable;
    const { error } = await supabase().from("liquidaciones").upsert(cuerpo, { onConflict: "trabajador_id,anio,mes" });
    setAviso(error ? error.message : pagar ? "Liquidación pagada. No se volverá a calcular." : "Borrador guardado.");
    if (pagar) setCerrada(true);
  }

  return (
    <div className="space-y-3 p-3">
      <Link className="btn" href="/personal">Volver al personal</Link>
      <h1 className="text-lg font-semibold">Liquidación</h1>
      <div className="grid gap-2 md:grid-cols-4">
        <select value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}><option value="">Trabajador</option>{trabajadores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        <input type="number" value={mes} onChange={(e) => setMes(Number(e.target.value))} />
        <button className="btn btn-solido" onClick={() => void calcular()}>Calcular</button>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        <label className="campo"><span className="etiqueta">Horas extra</span><input value={horasExtra} onChange={(e) => setHorasExtra(Number(e.target.value))} /></label>
        <label className="campo"><span className="etiqueta">Domingos y festivos</span><input value={diasDomingo} onChange={(e) => setDiasDomingo(Number(e.target.value))} /></label>
        <label className="campo"><span className="etiqueta">Otro descuento</span><input value={otrosNombre} onChange={(e) => setOtrosNombre(e.target.value)} /></label>
        <label className="campo"><span className="etiqueta">Monto</span><input value={otrosMonto} onChange={(e) => setOtrosMonto(Number(e.target.value))} /></label>
      </div>
      {aviso && <p className="aviso">{aviso}</p>}
      <div className="marco space-y-1 p-3">{resultado.map((linea) => <p key={linea}>{linea}</p>)}</div>
      <p className="text-[#5c6478]">El sistema no declara en Previred. Este resumen de imposiciones se usa para declararlo afuera.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={cerrada || !detalle} onClick={() => void guardar(false)}>Guardar corrección</button>
        <button className="btn btn-solido" disabled={cerrada || !detalle} onClick={() => void guardar(true)}>Marcar pagada</button>
        <button className="btn" disabled={resultado.length === 0} onClick={() => void pdfLiquidacion(`Liquidación ${mes}/${anio}`, resultado)}>PDF</button>
      </div>
    </div>
  );
}
