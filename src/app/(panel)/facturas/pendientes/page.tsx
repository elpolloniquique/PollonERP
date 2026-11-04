"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { estadoVisible, formatoPeso } from "@/lib/formato";
import { copiarReportePendientes } from "@/lib/reporteImagen";
import { Perfil, supabase } from "@/lib/supabase";

const ALTOS = [8, 11, 14, 18, 22, 26, 30];
const LETRAS = [8, 9, 10, 11, 12, 13, 14];
const COMODO = 5;

type Factura = { id: string; proveedor_id: string; numero: string; fecha_ingreso: string; saldo: number; estado: string; reservada_rapel?: boolean; con_rapel?: boolean };
type Proveedor = { id: string; nombre: string };

export default function Pendientes() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [elegido, setElegido] = useState("");
  const [zoom, setZoom] = useState(COMODO);
  const [altoZona, setAltoZona] = useState(640);
  const zona = useRef<HTMLDivElement>(null);

  async function cargar() {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!empresaId) return;
    const [listaProveedores, listaFacturas] = await Promise.all([
      supabase().from("proveedores").select("id, nombre").eq("empresa_id", empresaId).eq("activo", true).order("nombre"),
      supabase().from("facturas").select("id, proveedor_id, numero, fecha_ingreso, saldo, estado, reservada_rapel, con_rapel").eq("empresa_id", empresaId).in("estado", ["pendiente", "pago_parcial"]).gt("saldo", 0).order("fecha_ingreso"),
    ]);
    const crudas = (listaFacturas.error
      ? ((await supabase().from("facturas").select("id, proveedor_id, numero, fecha_ingreso, saldo, estado").eq("empresa_id", empresaId).in("estado", ["pendiente", "pago_parcial"]).gt("saldo", 0).order("fecha_ingreso")).data ?? [])
      : (listaFacturas.data ?? [])) as Factura[];
    setProveedores((listaProveedores.data ?? []) as Proveedor[]);
    setFacturas(crudas.filter((fila) => !fila.reservada_rapel));
  }

  useEffect(() => {
    void cargar();
    const canal = supabase().channel("pendientes").on("postgres_changes", { event: "*", schema: "public", table: "facturas" }, () => void cargar()).subscribe();
    return () => { void supabase().removeChannel(canal); };
  }, []);

  useEffect(() => {
    const medir = () => setAltoZona(zona.current?.clientHeight ?? 640);
    medir();
    const observador = new ResizeObserver(medir);
    if (zona.current) observador.observe(zona.current);
    return () => observador.disconnect();
  }, []);

  const delProveedor = facturas.filter((factura) => factura.proveedor_id === elegido);
  const total = delProveedor.reduce((suma, factura) => suma + Number(factura.saldo), 0);
  const periodo = delProveedor.length
    ? `${fechaCorta(delProveedor[0].fecha_ingreso)} al ${fechaCorta(delProveedor[delProveedor.length - 1].fecha_ingreso)}`
    : hoySantiago();
  const nombre = proveedores.find((item) => item.id === elegido)?.nombre ?? "";
  const conSaldo = useMemo(() => new Set(facturas.map((factura) => factura.proveedor_id)), [facturas]);

  const altoComodo = ALTOS[COMODO] * delProveedor.length + 36;
  const pocas = altoComodo + 220 <= altoZona;
  const cabe = ALTOS[zoom] * delProveedor.length + 36 <= altoZona;
  const menosDetenido = cabe;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h1 className="titulo-barra shrink-0">Facturas pendientes</h1>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[176px_minmax(560px,1fr)_148px]">
        <aside className="overflow-auto border-r border-[#d5e4e1] bg-white">
          {proveedores.filter((item) => conSaldo.has(item.id)).map((item) => (
            <button key={item.id} className={`block w-full px-3 py-2 text-left ${elegido === item.id ? "bg-[#C9E4FB]" : "hover:bg-[#E7F4F2]"}`} onClick={() => setElegido(item.id)}>{item.nombre}</button>
          ))}
          {proveedores.filter((item) => conSaldo.has(item.id)).length === 0 && <p className="p-3 text-[#60716f]">Sin facturas pendientes.</p>}
        </aside>
        <div ref={zona} className="min-h-0 overflow-hidden p-3">
          <div className={pocas ? "flex flex-col items-center" : "flex items-start gap-3"}>
            <div className="w-[560px] max-w-full">
              <div className="overflow-auto border border-[#d5e4e1] bg-white" style={{ maxHeight: cabe ? undefined : altoZona - 40 }}>
                <table className="tabla" style={{ fontSize: LETRAS[zoom] }}>
                  <thead><tr><th>Fecha</th><th>Factura</th><th className="text-right">Monto</th><th>Estado</th></tr></thead>
                  <tbody>
                    {delProveedor.map((factura) => (
                      <tr key={factura.id} style={{ height: ALTOS[zoom] }} onDoubleClick={() => { window.location.href = `/facturas/${factura.id}`; }}>
                        <td>{fechaCorta(factura.fecha_ingreso)}</td>
                        <td>{factura.numero}</td>
                        <td className="text-right">{formatoPeso(factura.saldo)}</td>
                        <td>{estadoVisible(factura.estado, Boolean(factura.con_rapel))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between bg-[#2436F0] px-3 py-2 font-semibold text-white">
                <span>Total por pagar</span><span>{formatoPeso(total)}</span>
              </div>
            </div>
            <Tarjeta nombre={nombre} periodo={periodo} total={total} />
          </div>
        </div>
        <aside className="flex flex-col items-center gap-2 border-l border-[#d5e4e1] bg-white p-2">
          <button className="btn btn-angosto" disabled={menosDetenido || zoom === 0} onClick={() => setZoom(zoom - 1)}>−</button>
          <button className="btn btn-angosto" disabled={zoom === ALTOS.length - 1} onClick={() => setZoom(zoom + 1)}>+</button>
          <a className="btn btn-angosto" href="/facturas/nueva">Nueva factura</a>
          <a className="btn btn-angosto" href="/pagos/registrar">Registrar pago</a>
          <button className="btn w-[132px] whitespace-normal text-center" disabled={!elegido || delProveedor.length === 0} onClick={() => void copiarReportePendientes(delProveedor.map((factura) => ({ fecha: factura.fecha_ingreso, numero: factura.numero, saldo: Number(factura.saldo), estado: factura.estado })), nombre, periodo, total)}>Enviar reporte por WhatsApp</button>
        </aside>
      </div>
    </div>
  );
}

function Tarjeta({ nombre, periodo, total }: { nombre: string; periodo: string; total: number }) {
  return (
    <article className="mt-3 w-[228px] shrink-0 border border-[#d5e4e1] bg-white p-3 lg:mt-0">
      <p className="font-semibold">{nombre || "Proveedor"}</p>
      <p className="mt-2 text-[#3e5552]">{periodo}</p>
      <p className="mt-3 text-lg font-semibold text-[#2436F0]">{formatoPeso(total)}</p>
    </article>
  );
}
