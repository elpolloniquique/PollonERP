"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Perfil, supabase } from "@/lib/supabase";

export default function Parametros() {
  const [empresaId, setEmpresaId] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [form, setForm] = useState({ ingreso_minimo: 0, porcentaje_gratificacion: 0.25, factor_tope_gratificacion: 4.75, recargo_hora_extra: 0.5, recargo_domingo: 0.5, horas_jornada: 8, tasa_fonasa: 0.07, tasa_cesantia: 0.006, valor_uf: 0, tope_imponible: 0 });
  const [desde, setDesde] = useState("0");
  const [hasta, setHasta] = useState("");
  const [factor, setFactor] = useState("0");
  const [rebaja, setRebaja] = useState("0");
  const [afp, setAfp] = useState({ mes: 1, nombre: "", tasa: 0, comision: 0, seguro: 0 });
  const [area, setArea] = useState({ area: "", mes: 1, monto: 0 });
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
      setEmpresaId((perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id ?? "");
    })();
  }, []);

  async function guardarAnio() {
    const { error } = await supabase().from("parametros_anio").upsert({ empresa_id: empresaId, anio, ...form }, { onConflict: "empresa_id,anio" });
    setAviso(error ? error.message : "Parámetros del año guardados.");
  }

  return (
    <div className="space-y-4 p-3">
      <Link className="btn" href="/personal">Volver al personal</Link>
      <section className="marco space-y-3 p-3">
        <h1 className="text-lg font-semibold">Parámetros {anio}</h1>
        <input className="max-w-32" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        <div className="grilla-campos">
          {([
            ["ingreso_minimo", "Ingreso mínimo"],
            ["porcentaje_gratificacion", "Porcentaje gratificación"],
            ["factor_tope_gratificacion", "Tope en ingresos mínimos"],
            ["recargo_hora_extra", "Recargo hora extra"],
            ["recargo_domingo", "Recargo domingo y festivo"],
            ["horas_jornada", "Horas de jornada"],
            ["tasa_fonasa", "Tasa de salud legal"],
            ["tasa_cesantia", "Seguro de cesantía del trabajador"],
            ["valor_uf", "Valor UF"],
            ["tope_imponible", "Tope imponible"],
          ] as const).map(([campo, etiqueta]) => (
            <label key={campo} className="campo"><span className="etiqueta">{etiqueta}</span><input value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: Number(e.target.value) })} /></label>
          ))}
        </div>
        <button className="btn btn-solido" onClick={() => void guardarAnio()}>Guardar año</button>
      </section>
      <section className="marco space-y-2 p-3">
        <h2 className="font-semibold">Tramo de impuesto único</h2>
        <div className="grid gap-2 md:grid-cols-4">
          <input placeholder="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <input placeholder="Hasta, vacío si es el último" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <input placeholder="Factor" value={factor} onChange={(e) => setFactor(e.target.value)} />
          <input placeholder="Rebaja" value={rebaja} onChange={(e) => setRebaja(e.target.value)} />
        </div>
        <button className="btn" onClick={() => void supabase().from("tramos_impuesto").insert({ empresa_id: empresaId, anio, desde: Number(desde), hasta: hasta ? Number(hasta) : null, factor: Number(factor), rebaja: Number(rebaja) }).then(({ error }) => setAviso(error?.message ?? "Tramo agregado."))}>Agregar tramo</button>
      </section>
      <section className="marco space-y-2 p-3">
        <h2 className="font-semibold">AFP del periodo</h2>
        <div className="grid gap-2 md:grid-cols-5">
          <input type="number" value={afp.mes} onChange={(e) => setAfp({ ...afp, mes: Number(e.target.value) })} />
          <input placeholder="Fondo" value={afp.nombre} onChange={(e) => setAfp({ ...afp, nombre: e.target.value })} />
          <input placeholder="Tasa" value={afp.tasa} onChange={(e) => setAfp({ ...afp, tasa: Number(e.target.value) })} />
          <input placeholder="Comisión" value={afp.comision} onChange={(e) => setAfp({ ...afp, comision: Number(e.target.value) })} />
          <input placeholder="Seguro" value={afp.seguro} onChange={(e) => setAfp({ ...afp, seguro: Number(e.target.value) })} />
        </div>
        <button className="btn" onClick={() => void supabase().from("afp_periodo").insert({ empresa_id: empresaId, anio, ...afp }).then(({ error }) => setAviso(error?.message ?? "AFP guardada."))}>Guardar AFP</button>
      </section>
      <section className="marco space-y-2 p-3">
        <h2 className="font-semibold">Bono por área</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input placeholder="Área" value={area.area} onChange={(e) => setArea({ ...area, area: e.target.value })} />
          <input type="number" value={area.mes} onChange={(e) => setArea({ ...area, mes: Number(e.target.value) })} />
          <input placeholder="Monto" value={area.monto} onChange={(e) => setArea({ ...area, monto: Number(e.target.value) })} />
        </div>
        <button className="btn" onClick={() => void supabase().from("bonos_area").insert({ empresa_id: empresaId, anio, ...area }).then(({ error }) => setAviso(error?.message ?? "Bono guardado."))}>Guardar bono</button>
      </section>
      {aviso && <p className="aviso">{aviso}</p>}
    </div>
  );
}
