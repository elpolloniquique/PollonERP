"use client";

import { useEffect, useState } from "react";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { estadoVisible, formatoPeso, parseMonto, textoMonto } from "@/lib/formato";
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
    <div className="pago-pantalla">
      <h1 className="titulo-barra">Abono parcial</h1>
      <div className="pago-cuerpo pago-cuerpo-ancho">
        <div className="pago-tabla-caja escritorio-solo">
          <div className="tabla-scroll">
            <table className="tabla pago-tabla">
              <thead>
                <tr>
                  <th className="pago-col-check" />
                  <th>Fecha</th>
                  <th>Factura</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 && (
                  <tr><td colSpan={5}>{proveedorId ? "Este proveedor no tiene saldo pendiente." : "Seleccione un proveedor."}</td></tr>
                )}
                {facturas.map((item) => (
                  <tr key={item.id} className={marcada === item.id ? "pago-fila-activa" : ""} onClick={() => setMarcada(item.id)}>
                    <td className="pago-col-check">
                      <input className="w-auto" type="radio" name="factura" checked={marcada === item.id} onChange={() => setMarcada(item.id)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td className="nowrap">{fechaCorta(item.fecha_ingreso)}</td>
                    <td className="nowrap">{item.numero}</td>
                    <td className="nowrap saldo-rojo">{formatoPeso(item.saldo)}</td>
                    <td className="nowrap">{estadoVisible(item.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lista-cartas movil-solo pago-cartas">
          {facturas.length === 0 && <p className="pendientes-vacio">{proveedorId ? "Sin saldo pendiente." : "Seleccione un proveedor."}</p>}
          {facturas.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`carta-factura ${marcada === item.id ? "elegida" : ""}`}
              onClick={() => setMarcada(item.id)}
            >
              <div className="carta-factura-arriba">
                <span className="carta-factura-numero">{item.numero}</span>
                <span className="carta-factura-estado">{estadoVisible(item.estado)}</span>
              </div>
              <div className="carta-factura-abajo">
                <span>{fechaCorta(item.fecha_ingreso)}</span>
                <strong>{formatoPeso(item.saldo)}</strong>
              </div>
            </button>
          ))}
        </div>

        <aside className="pago-form">
          <label className="campo">
            <span className="etiqueta">Proveedor</span>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Seleccione</option>
              {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label className="campo">
            <span className="etiqueta">Monto que pagó la jefa</span>
            <input value={monto} onChange={(e) => setMonto(textoMonto(e.target.value))} inputMode="numeric" placeholder="$ 0" />
          </label>
          <label className="campo">
            <span className="etiqueta">Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          {factura && (
            <p className="pago-queda">Saldo que queda <strong>{formatoPeso(queda)}</strong></p>
          )}
          {mensaje && <p className={`pago-aviso ${mensaje.startsWith("Abono registrado") ? "pago-aviso-ok" : ""}`}>{mensaje}</p>}
          <button className="btn btn-solido pago-boton" onClick={() => void registrar()}>Registrar pago {formatoPeso(abono)}</button>
        </aside>
      </div>
    </div>
  );
}
