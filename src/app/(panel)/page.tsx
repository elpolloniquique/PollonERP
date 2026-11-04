"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fechaCorta, hoySantiago, semaforoVencimiento, sumarDias } from "@/lib/fechas";
import { estadoVisible, formatoPeso } from "@/lib/formato";
import { mostrarRut } from "@/lib/rut";
import { Empresa, Perfil, supabase } from "@/lib/supabase";

type Aviso = { id: string; numero: string; proveedor: string; vencimiento: string; saldo: number; luz: "vencida" | "tres" | "siete" };
type Pago = { id: string; fecha: string; proveedor: string; monto: number };

export default function Inicio() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);

  async function cargar() {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!empresaId) return;
    const empresaCargada = await supabase().from("empresas").select("*").eq("id", empresaId).single();
    if (empresaCargada.data) setEmpresa(empresaCargada.data as Empresa);

    const hoy = hoySantiago();
    const limite = sumarDias(hoy, 7);
    const facturas = await supabase()
      .from("facturas")
      .select("id, numero, fecha_vencimiento, saldo, proveedores(nombre)")
      .eq("empresa_id", empresaId)
      .in("estado", ["pendiente", "pago_parcial"])
      .gt("saldo", 0)
      .lte("fecha_vencimiento", limite)
      .order("fecha_vencimiento");
    setAvisos(((facturas.data ?? []) as FilaFactura[]).flatMap((fila) => {
      const luz = semaforoVencimiento(fila.fecha_vencimiento, hoy);
      if (!luz) return [];
      const proveedor = Array.isArray(fila.proveedores) ? fila.proveedores[0] : fila.proveedores;
      return [{ id: fila.id, numero: fila.numero, proveedor: proveedor?.nombre ?? "", vencimiento: fila.fecha_vencimiento, saldo: Number(fila.saldo), luz }];
    }));

    const pagosCargados = await supabase()
      .from("pagos")
      .select("id, fecha, monto, proveedores(nombre)")
      .eq("empresa_id", empresaId)
      .order("creado_en", { ascending: false })
      .limit(20);
    setPagos(((pagosCargados.data ?? []) as FilaPago[]).map((fila) => {
      const proveedor = Array.isArray(fila.proveedores) ? fila.proveedores[0] : fila.proveedores;
      return { id: fila.id, fecha: fila.fecha, monto: Number(fila.monto), proveedor: proveedor?.nombre ?? "" };
    }));
  }

  useEffect(() => {
    void cargar();
    const canal = supabase()
      .channel("inicio")
      .on("postgres_changes", { event: "*", schema: "public", table: "facturas" }, () => void cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, () => void cargar())
      .subscribe();
    return () => { void supabase().removeChannel(canal); };
  }, []);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[260px_minmax(280px,1fr)_minmax(240px,1fr)]">
      <section className="marco flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <img src="/icon.svg" alt="" width={72} height={72} />
          <h1 className="mt-3 text-base font-semibold">{empresa?.nombre_comercial ?? "Empresa"}</h1>
          <p className="mt-2 leading-5 text-[#3e5552]">
            {empresa?.razon_social}<br />
            {empresa?.rut ? mostrarRut(empresa.rut) : ""}<br />
            {empresa?.giro}<br />
            {empresa?.direccion}<br />
            {empresa?.telefono}<br />
            {empresa?.correo}
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-[#d5e4e1] p-3">
          <Link className="btn text-center" href="/facturas/nueva">Nueva factura</Link>
          <Link className="btn text-center" href="/pagos/registrar">Registrar pago</Link>
        </div>
      </section>
      <Tabla titulo="Facturas por vencer y vencidas" vacio="No hay facturas por vencer en los próximos siete días.">
        {avisos.map((aviso) => (
          <tr key={aviso.id} className={`semaforo-${aviso.luz}`}>
            <td><span className={`punto punto-${aviso.luz}`} /></td>
            <td>{aviso.proveedor}</td>
            <td>{aviso.numero}</td>
            <td>{fechaCorta(aviso.vencimiento)}</td>
            <td className="text-right">{formatoPeso(aviso.saldo)}</td>
          </tr>
        ))}
      </Tabla>
      <Tabla titulo="Últimos pagos registrados" vacio="Todavía no hay pagos registrados.">
        {pagos.map((pago) => (
          <tr key={pago.id}>
            <td>{fechaCorta(pago.fecha)}</td>
            <td>{pago.proveedor}</td>
            <td className="text-right">{formatoPeso(pago.monto)}</td>
          </tr>
        ))}
      </Tabla>
    </div>
  );
}

function Tabla({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode }) {
  const lista = Array.isArray(children) ? children : [children];
  const hay = lista.some(Boolean);
  return (
    <section className="marco flex min-h-[220px] min-w-0 flex-col lg:min-h-0">
      <h2 className="titulo-barra">{titulo}</h2>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="tabla">
          <tbody>{hay ? children : <tr><td className="text-[#60716f]">{vacio}</td></tr>}</tbody>
        </table>
      </div>
    </section>
  );
}

type FilaFactura = { id: string; numero: string; fecha_vencimiento: string; saldo: number; proveedores: { nombre: string } | { nombre: string }[] | null };
type FilaPago = { id: string; fecha: string; monto: number; proveedores: { nombre: string } | { nombre: string }[] | null };
