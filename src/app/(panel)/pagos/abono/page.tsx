"use client";

import { useEffect, useState } from "react";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { formatoPeso } from "@/lib/formato";
import { aplicarPago } from "@/lib/pago";
import { Perfil, supabase } from "@/lib/supabase";

type Factura = { id: string; numero: string; fecha_ingreso: string; saldo: number; abonado: number; total_oficial: number; estado: string };
type Proveedor = { id: string; nombre: string };

export default function Abono() {
  const [empresaId, setEmpresaId] = useState("");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [marcada, setMarcada] = useState("");
  const [fecha, setFecha] = useState(hoySantiago());
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
    void supabase().from("facturas").select("id, numero, fecha_ingreso, saldo, abonado, total_oficial, estado").eq("proveedor_id", proveedorId).in("estado", ["pendiente", "pago_parcial"]).gt("saldo", 0).order("fecha_ingreso")
      .then(({ data }) => { setFacturas((data ?? []) as Factura[]); setMarcada(""); });
  }, [proveedorId]);

  const factura = facturas.find((item) => item.id === marcada);
  const abono = Number(monto.replace(/\./g, "")) || 0;
  const queda = factura ? Math.max(Number(factura.saldo) - abono, 0) : 0;

  async function registrar() {
    if (!factura) { setMensaje("Marque una sola factura."); return; }
    if (abono <= 0 || abono > Number(factura.saldo)) { setMensaje("El abono tiene que ser mayor que cero y no puede pasar el saldo."); return; }
    const error = await aplicarPago({
      empresaId, proveedorId, fecha, monto: abono, observacion: "", esAbono: true,
      facturas: [{ id: factura.id, abonado: Number(factura.abonado), total: Number(factura.total_oficial), aplicar: abono }],
    });
    if (error) { setMensaje(error); return; }
    setMensaje(`Abono registrado. Saldo que queda ${formatoPeso(queda)}.`);
    setMonto("");
    setMarcada("");
    setFacturas(facturas.map((item) => item.id === factura.id ? { ...item, saldo: Number(item.saldo) - abono, abonado: Number(item.abonado) + abono } : item).filter((item) => item.saldo > 0));
  }

  return (
    <div className="flex min-h-[70dvh] flex-col p-3">
      <h1 className="titulo-barra">Abono parcial</h1>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="marco overflow-auto">
          <table className="tabla">
            <thead><tr><th></th><th>Fecha</th><th>Factura</th><th>Saldo</th><th>Estado</th></tr></thead>
            <tbody>
              {facturas.map((item) => (
                <tr key={item.id} className={marcada === item.id ? "elegida" : ""}>
                  <td><input className="w-auto" type="radio" name="factura" checked={marcada === item.id} onChange={() => setMarcada(item.id)} /></td>
                  <td>{fechaCorta(item.fecha_ingreso)}</td>
                  <td>{item.numero}</td>
                  <td>{formatoPeso(item.saldo)}</td>
                  <td>{item.estado === "pago_parcial" ? "Pago parcial" : "Pendiente"}</td>
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
          <label className="campo"><span className="etiqueta">Monto que pagó la jefa</span><input value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
          <label className="campo"><span className="etiqueta">Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Número</th><th>Monto</th></tr></thead>
            <tbody>{factura && <tr><td>{fechaCorta(factura.fecha_ingreso)}</td><td>{factura.numero}</td><td>{formatoPeso(factura.total_oficial)}</td></tr>}</tbody>
          </table>
          <p>Saldo que queda <strong>{formatoPeso(queda)}</strong></p>
          {mensaje && <p className="aviso">{mensaje}</p>}
          <button className="btn btn-solido w-full" onClick={() => void registrar()}>Registrar pago {formatoPeso(abono)}</button>
        </aside>
      </div>
    </div>
  );
}
