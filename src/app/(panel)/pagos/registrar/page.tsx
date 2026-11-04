"use client";

import { useEffect, useState } from "react";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { formatoPeso } from "@/lib/formato";
import { aplicarPago } from "@/lib/pago";
import { Perfil, supabase } from "@/lib/supabase";

type Factura = { id: string; numero: string; fecha_ingreso: string; saldo: number; abonado: number; total_oficial: number };
type Proveedor = { id: string; nombre: string };

export default function RegistrarPago() {
  const [empresaId, setEmpresaId] = useState("");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [fecha, setFecha] = useState(hoySantiago());
  const [observacion, setObservacion] = useState("");
  const [monto, setMonto] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
      const id = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id ?? "";
      setEmpresaId(id);
      const lista = await supabase().from("proveedores").select("id, nombre").eq("empresa_id", id).eq("activo", true).order("nombre");
      setProveedores((lista.data ?? []) as Proveedor[]);
    })();
  }, []);

  useEffect(() => {
    if (!proveedorId) return;
    void supabase().from("facturas").select("id, numero, fecha_ingreso, saldo, abonado, total_oficial, reservada_rapel").eq("proveedor_id", proveedorId).in("estado", ["pendiente", "pago_parcial"]).gt("saldo", 0).order("fecha_ingreso")
      .then(async (consulta) => {
        const datos = consulta.error
          ? (await supabase().from("facturas").select("id, numero, fecha_ingreso, saldo, abonado, total_oficial").eq("proveedor_id", proveedorId).in("estado", ["pendiente", "pago_parcial"]).gt("saldo", 0).order("fecha_ingreso")).data
          : consulta.data;
        setFacturas(((datos ?? []) as (Factura & { reservada_rapel?: boolean })[]).filter((fila) => !fila.reservada_rapel));
        setMarcadas([]);
      });
  }, [proveedorId]);

  const elegidas = facturas.filter((factura) => marcadas.includes(factura.id));
  const suma = elegidas.reduce((total, factura) => total + Number(factura.saldo), 0);

  async function registrar() {
    const pagado = Number(monto.replace(/\./g, ""));
    if (pagado !== suma) {
      setMensaje("El monto tiene que ser igual a la suma de los saldos marcados. Si es menor, use Abono parcial.");
      return;
    }
    const error = await aplicarPago({
      empresaId,
      proveedorId,
      fecha,
      monto: pagado,
      observacion,
      esAbono: false,
      facturas: elegidas.map((factura) => ({ id: factura.id, abonado: Number(factura.abonado), total: Number(factura.total_oficial), aplicar: Number(factura.saldo) })),
    });
    if (error) { setMensaje(error); return; }
    setMensaje("Pago registrado por transferencia.");
    setMarcadas([]);
    setMonto("");
    setFacturas(facturas.filter((factura) => !marcadas.includes(factura.id)));
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-2 sm:p-3">
      <div className="marco flex min-h-0 flex-1 flex-col overflow-hidden">
        <h1 className="titulo-barra">Registrar pago</h1>
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <aside className="order-1 space-y-3 lg:order-2">
            <label className="campo"><span className="etiqueta">Proveedor</span>
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">Seleccione</option>
                {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>
            <div className="rounded-xl border border-[var(--linea)] p-3">
              <p className="font-semibold">Total {formatoPeso(suma)}</p>
              <p className="mt-1 text-[#5c6478]">Medio: transferencia</p>
              {elegidas.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-[#5c6478]">
                  {elegidas.map((factura) => (
                    <li key={factura.id} className="flex justify-between gap-2">
                      <span>{factura.numero}</span>
                      <span className="nowrap">{formatoPeso(factura.saldo)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <label className="campo"><span className="etiqueta">Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            <label className="campo"><span className="etiqueta">Observación</span><input value={observacion} onChange={(e) => setObservacion(e.target.value)} /></label>
            <label className="campo"><span className="etiqueta">Monto que pagó la jefa</span><input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" /></label>
            {mensaje && <p className="aviso">{mensaje}</p>}
            <button className="btn btn-solido w-full" onClick={() => void registrar()}>Registrar pago</button>
          </aside>
          <div className="order-2 min-h-0 lg:order-1">
            <div className="tabla-scroll escritorio-solo rounded-xl border border-[var(--linea)]">
              <table className="tabla">
                <thead><tr><th></th><th>Fecha</th><th>Factura</th><th className="text-right">Saldo</th></tr></thead>
                <tbody>
                  {facturas.map((factura) => (
                    <tr key={factura.id}>
                      <td><input className="w-auto" type="checkbox" checked={marcadas.includes(factura.id)} onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, factura.id] : marcadas.filter((id) => id !== factura.id))} /></td>
                      <td className="nowrap">{fechaCorta(factura.fecha_ingreso)}</td>
                      <td className="nowrap">{factura.numero}</td>
                      <td className="text-right nowrap">{formatoPeso(factura.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lista-cartas movil-solo !flex">
              {facturas.length === 0 && <p className="pendientes-vacio">Elija un proveedor para ver sus facturas.</p>}
              {facturas.map((factura) => {
                const marcada = marcadas.includes(factura.id);
                return (
                  <button
                    key={factura.id}
                    type="button"
                    className={`carta-factura ${marcada ? "elegida" : ""}`}
                    onClick={() => setMarcadas(marcada ? marcadas.filter((id) => id !== factura.id) : [...marcadas, factura.id])}
                  >
                    <div className="carta-factura-arriba">
                      <span className="carta-factura-numero">{factura.numero}</span>
                      <span className="carta-factura-estado">{marcada ? "Marcada" : "Marcar"}</span>
                    </div>
                    <div className="carta-factura-abajo">
                      <span>{fechaCorta(factura.fecha_ingreso)}</span>
                      <strong>{formatoPeso(factura.saldo)}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
