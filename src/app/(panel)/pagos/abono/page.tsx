"use client";

import { useEffect, useState } from "react";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { formatoPeso, parseMonto, textoMonto } from "@/lib/formato";
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
  const abono = parseMonto(monto) ?? 0;
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
    <div className="flex h-full min-h-0 flex-col p-2 sm:p-3">
      <div className="marco flex min-h-0 flex-1 flex-col overflow-hidden">
        <h1 className="titulo-barra">Abono parcial</h1>
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <aside className="order-1 space-y-3 lg:order-2">
            <label className="campo"><span className="etiqueta">Proveedor</span>
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">Seleccione</option>
                {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </label>
            <label className="campo"><span className="etiqueta">Monto que pagó la jefa</span><input value={monto} onChange={(e) => setMonto(textoMonto(e.target.value))} inputMode="numeric" placeholder="$ 0" /></label>
            <label className="campo"><span className="etiqueta">Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            {factura && (
              <div className="rounded-xl border border-[var(--linea)] p-3">
                <p className="font-semibold">{factura.numero}</p>
                <p className="mt-1 text-sm text-[#5c6478]">{fechaCorta(factura.fecha_ingreso)}</p>
                <p className="mt-2">Saldo que queda <strong>{formatoPeso(queda)}</strong></p>
              </div>
            )}
            {mensaje && <p className="aviso">{mensaje}</p>}
            <button className="btn btn-solido w-full" onClick={() => void registrar()}>Registrar pago {formatoPeso(abono)}</button>
          </aside>
          <div className="order-2 min-h-0 lg:order-1">
            <div className="tabla-scroll escritorio-solo rounded-xl border border-[var(--linea)]">
              <table className="tabla">
                <thead><tr><th></th><th>Fecha</th><th>Factura</th><th>Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {facturas.map((item) => (
                    <tr key={item.id} className={marcada === item.id ? "elegida" : ""}>
                      <td><input className="w-auto" type="radio" name="factura" checked={marcada === item.id} onChange={() => setMarcada(item.id)} /></td>
                      <td className="nowrap">{fechaCorta(item.fecha_ingreso)}</td>
                      <td className="nowrap">{item.numero}</td>
                      <td className="nowrap">{formatoPeso(item.saldo)}</td>
                      <td>{item.estado === "pago_parcial" ? "Pago parcial" : "Pendiente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lista-cartas movil-solo">
              {facturas.length === 0 && <p className="pendientes-vacio">Elija un proveedor para ver sus facturas.</p>}
              {facturas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`carta-factura ${marcada === item.id ? "elegida" : ""}`}
                  onClick={() => setMarcada(item.id)}
                >
                  <div className="carta-factura-arriba">
                    <span className="carta-factura-numero">{item.numero}</span>
                    <span className="carta-factura-estado">{item.estado === "pago_parcial" ? "Pago parcial" : "Pendiente"}</span>
                  </div>
                  <div className="carta-factura-abajo">
                    <span>{fechaCorta(item.fecha_ingreso)}</span>
                    <strong>{formatoPeso(item.saldo)}</strong>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
