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
    <div className="flex h-full min-h-[70dvh] flex-col p-3">
      <h1 className="titulo-barra">Registrar pago</h1>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="marco min-h-0 overflow-auto">
          <table className="tabla">
            <thead><tr><th></th><th>Fecha</th><th>Factura</th><th className="text-right">Saldo</th></tr></thead>
            <tbody>
              {facturas.map((factura) => (
                <tr key={factura.id}>
                  <td><input className="w-auto" type="checkbox" checked={marcadas.includes(factura.id)} onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, factura.id] : marcadas.filter((id) => id !== factura.id))} /></td>
                  <td>{fechaCorta(factura.fecha_ingreso)}</td>
                  <td>{factura.numero}</td>
                  <td className="text-right">{formatoPeso(factura.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="marco space-y-3 p-3">
          <label className="campo"><span className="etiqueta">Proveedor</span>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Seleccione</option>
              {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <div className="max-h-40 overflow-auto border border-[var(--linea)]">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Factura</th><th>Saldo</th></tr></thead>
              <tbody>{elegidas.map((factura) => <tr key={factura.id}><td>{fechaCorta(factura.fecha_ingreso)}</td><td>{factura.numero}</td><td>{formatoPeso(factura.saldo)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="font-semibold">Total {formatoPeso(suma)}</p>
          <p className="text-[#5c6478]">Medio: transferencia</p>
          <label className="campo"><span className="etiqueta">Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
          <label className="campo"><span className="etiqueta">Observación</span><input value={observacion} onChange={(e) => setObservacion(e.target.value)} /></label>
          <label className="campo"><span className="etiqueta">Monto que pagó la jefa</span><input value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
          {mensaje && <p className="aviso">{mensaje}</p>}
          <button className="btn btn-solido w-full" onClick={() => void registrar()}>Registrar pago</button>
        </aside>
      </div>
    </div>
  );
}
