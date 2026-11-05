"use client";

import { useEffect, useState } from "react";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { formatoPeso, parseMonto, textoMonto } from "@/lib/formato";
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
    const pagado = parseMonto(monto) ?? 0;
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

  function marcar(id: string, activo: boolean) {
    setMarcadas(activo ? [...marcadas, id] : marcadas.filter((item) => item !== id));
  }

  return (
    <div className="pago-pantalla">
      <h1 className="titulo-barra">Registrar pago</h1>
      <div className="pago-cuerpo">
        <div className="pago-tabla-caja escritorio-solo">
          <div className="tabla-scroll">
            <table className="tabla pago-tabla">
              <thead>
                <tr>
                  <th className="pago-col-check" />
                  <th>Fecha</th>
                  <th>Factura</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 && (
                  <tr><td colSpan={4}>{proveedorId ? "Este proveedor no tiene saldo pendiente." : "Seleccione un proveedor."}</td></tr>
                )}
                {facturas.map((factura) => {
                  const marcada = marcadas.includes(factura.id);
                  return (
                    <tr key={factura.id} className={marcada ? "pago-fila-activa" : ""} onClick={() => marcar(factura.id, !marcada)}>
                      <td className="pago-col-check">
                        <input
                          className="w-auto"
                          type="checkbox"
                          checked={marcada}
                          onChange={(e) => marcar(factura.id, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="nowrap">{fechaCorta(factura.fecha_ingreso)}</td>
                      <td className="nowrap">{factura.numero}</td>
                      <td className="nowrap saldo-rojo">{formatoPeso(factura.saldo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lista-cartas movil-solo pago-cartas">
          {facturas.length === 0 && <p className="pendientes-vacio">{proveedorId ? "Sin saldo pendiente." : "Seleccione un proveedor."}</p>}
          {facturas.map((factura) => {
            const marcada = marcadas.includes(factura.id);
            return (
              <button
                key={factura.id}
                type="button"
                className={`carta-factura ${marcada ? "elegida" : ""}`}
                onClick={() => marcar(factura.id, !marcada)}
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

        <aside className="pago-form">
          <label className="campo">
            <span className="etiqueta">Proveedor</span>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Seleccione</option>
              {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <p className="pago-total">Total {formatoPeso(suma)}</p>
          <p className="pago-medio">Medio: transferencia</p>
          <label className="campo">
            <span className="etiqueta">Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="campo">
            <span className="etiqueta">Observación</span>
            <input value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          </label>
          <label className="campo">
            <span className="etiqueta">Monto que pagó la jefa</span>
            <input value={monto} onChange={(e) => setMonto(textoMonto(e.target.value))} inputMode="numeric" placeholder="$ 0" />
          </label>
          {mensaje && <p className={`pago-aviso ${mensaje.startsWith("Pago registrado") ? "pago-aviso-ok" : ""}`}>{mensaje}</p>}
          <button className="btn btn-solido pago-boton" onClick={() => void registrar()}>Registrar pago</button>
        </aside>
      </div>
    </div>
  );
}
