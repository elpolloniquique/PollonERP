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

  const conSaldo = useMemo(() => proveedores.filter((item) => facturas.some((factura) => factura.proveedor_id === item.id)), [proveedores, facturas]);
  const delProveedor = facturas.filter((factura) => factura.proveedor_id === elegido);
  const total = delProveedor.reduce((suma, factura) => suma + Number(factura.saldo), 0);
  const periodo = delProveedor.length
    ? `${fechaCorta(delProveedor[0].fecha_ingreso)} al ${fechaCorta(delProveedor[delProveedor.length - 1].fecha_ingreso)}`
    : hoySantiago();
  const nombre = proveedores.find((item) => item.id === elegido)?.nombre ?? "";

  const altoComodo = ALTOS[COMODO] * delProveedor.length + 36;
  const pocas = altoComodo + 220 <= altoZona;
  const cabe = ALTOS[zoom] * delProveedor.length + 36 <= altoZona;
  const menosDetenido = cabe;

  useEffect(() => {
    if (!elegido && conSaldo.length > 0) setElegido(conSaldo[0].id);
  }, [conSaldo, elegido]);

  return (
    <div className="pendientes">
      <h1 className="titulo-barra shrink-0">Facturas pendientes</h1>

      <div className="pendientes-chips">
        {conSaldo.length === 0 && <p className="pendientes-vacio">Sin facturas pendientes.</p>}
        {conSaldo.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip ${elegido === item.id ? "chip-activo" : ""}`}
            onClick={() => setElegido(item.id)}
          >
            {item.nombre}
          </button>
        ))}
      </div>

      <div className="pendientes-cuerpo">
        <aside className="pendientes-lista">
          {conSaldo.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`block w-full px-3 py-2 text-left ${elegido === item.id ? "bg-[#C9E4FB]" : "hover:bg-[#E7F4F2]"}`}
              onClick={() => setElegido(item.id)}
            >
              {item.nombre}
            </button>
          ))}
          {conSaldo.length === 0 && <p className="p-3 text-[#60716f]">Sin facturas pendientes.</p>}
        </aside>

        <div ref={zona} className="pendientes-zona">
          <article className="tarjeta-resumen movil-solo">
            <div>
              <p className="tarjeta-resumen-nombre">{nombre || "Proveedor"}</p>
              <p className="tarjeta-resumen-periodo">{periodo}</p>
            </div>
            <p className="tarjeta-resumen-total">{formatoPeso(total)}</p>
          </article>

          <div className={pocas ? "pendientes-panel pendientes-panel-centrado" : "pendientes-panel"}>
            <div className="pendientes-tabla-caja">
              <div className="tabla-scroll escritorio-solo" style={{ maxHeight: cabe ? undefined : Math.max(altoZona - 40, 180) }}>
                <table className="tabla" style={{ fontSize: LETRAS[zoom] }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Factura</th>
                      <th className="text-right">Monto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delProveedor.map((factura) => (
                      <tr key={factura.id} style={{ height: ALTOS[zoom] }} onDoubleClick={() => { window.location.href = `/facturas/${factura.id}`; }}>
                        <td className="nowrap">{fechaCorta(factura.fecha_ingreso)}</td>
                        <td className="nowrap">{factura.numero}</td>
                        <td className="text-right nowrap">{formatoPeso(factura.saldo)}</td>
                        <td className="nowrap">{estadoVisible(factura.estado, Boolean(factura.con_rapel))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lista-cartas movil-solo">
                {delProveedor.length === 0 && elegido && (
                  <p className="pendientes-vacio">Este proveedor no tiene saldo pendiente.</p>
                )}
                {delProveedor.map((factura) => (
                  <button
                    key={factura.id}
                    type="button"
                    className="carta-factura"
                    onClick={() => { window.location.href = `/facturas/${factura.id}`; }}
                  >
                    <div className="carta-factura-arriba">
                      <span className="carta-factura-numero">{factura.numero}</span>
                      <span className="carta-factura-estado">{estadoVisible(factura.estado, Boolean(factura.con_rapel))}</span>
                    </div>
                    <div className="carta-factura-abajo">
                      <span>{fechaCorta(factura.fecha_ingreso)}</span>
                      <strong>{formatoPeso(factura.saldo)}</strong>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pendientes-total">
                <span>Total por pagar</span>
                <span>{formatoPeso(total)}</span>
              </div>
            </div>

            <article className="tarjeta-resumen escritorio-solo">
              <p className="tarjeta-resumen-nombre">{nombre || "Proveedor"}</p>
              <p className="tarjeta-resumen-periodo">{periodo}</p>
              <p className="tarjeta-resumen-total">{formatoPeso(total)}</p>
            </article>
          </div>
        </div>

        <aside className="pendientes-acciones">
          <div className="acciones-zoom escritorio-solo">
            <button type="button" className="btn btn-angosto" disabled={menosDetenido || zoom === 0} onClick={() => setZoom(zoom - 1)}>−</button>
            <button type="button" className="btn btn-angosto" disabled={zoom === ALTOS.length - 1} onClick={() => setZoom(zoom + 1)}>+</button>
          </div>
          <a className="btn btn-accion" href="/facturas/nueva">Nueva factura</a>
          <a className="btn btn-accion" href="/pagos/registrar">Registrar pago</a>
          <button
            type="button"
            className="btn btn-accion btn-whatsapp"
            disabled={!elegido || delProveedor.length === 0}
            onClick={() => void copiarReportePendientes(delProveedor.map((factura) => ({ fecha: factura.fecha_ingreso, numero: factura.numero, saldo: Number(factura.saldo), estado: factura.estado })), nombre, periodo, total)}
          >
            WhatsApp
          </button>
        </aside>
      </div>
    </div>
  );
}
