"use client";

import { useEffect, useMemo, useState } from "react";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { formatoPeso, parseMonto, textoMonto } from "@/lib/formato";
import { evaluarRapel } from "@/lib/rapel";
import { Perfil, supabase } from "@/lib/supabase";

type Factura = { id: string; numero: string; fecha_ingreso: string; saldo: number; abonado: number; total_oficial: number };
type Proveedor = { id: string; nombre: string; rapel_activo: boolean };

export default function Rapel() {
  const [empresaId, setEmpresaId] = useState("");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [monto, setMonto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [rapelId, setRapelId] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
      const id = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id ?? "";
      setEmpresaId(id);
      const lista = await supabase().from("proveedores").select("id, nombre, rapel_activo").eq("empresa_id", id).eq("activo", true).order("nombre");
      setProveedores((lista.data ?? []) as Proveedor[]);
    })();
  }, []);

  useEffect(() => {
    if (!proveedorId) return;
    void supabase().from("facturas").select("id, numero, fecha_ingreso, saldo, abonado, total_oficial").eq("proveedor_id", proveedorId).in("estado", ["pendiente", "pago_parcial"]).eq("reservada_rapel", false).gt("saldo", 0).order("fecha_ingreso")
      .then(({ data, error }) => {
        if (error) setMensaje("Ejecute supabase/modulos.sql para usar el rapel.");
        setFacturas((data ?? []) as Factura[]);
        setMarcadas([]);
        setRapelId("");
      });
  }, [proveedorId]);

  const proveedor = proveedores.find((item) => item.id === proveedorId);
  const elegidas = facturas.filter((factura) => marcadas.includes(factura.id));
  const cierre = useMemo(() => evaluarRapel(elegidas.map((factura) => Number(factura.saldo)), parseMonto(monto) ?? 0), [elegidas, monto]);

  async function armar() {
    if (!proveedor?.rapel_activo) { setMensaje("Este proveedor no tiene el rapel activo."); return; }
    if (!cierre.puedeCerrar) { setMensaje(cierre.mensaje); return; }
    const creado = await supabase().from("rapeles").insert({
      empresa_id: empresaId, proveedor_id: proveedorId, fecha: hoySantiago(), monto: cierre.montoRapel, saldo: cierre.sobrante, estado: "borrador",
    }).select("id").single();
    if (creado.error || !creado.data) { setMensaje(creado.error?.message ?? "No se armó."); return; }
    let cubiertoRestante = cierre.cubierto;
    for (const factura of elegidas) {
      const cubre = Math.min(Number(factura.saldo), Math.max(cubiertoRestante, 0));
      cubiertoRestante -= cubre;
      await supabase().from("rapel_facturas").insert({ rapel_id: creado.data.id, factura_id: factura.id, saldo: factura.saldo, cubierto: cubre, paga_duena: Number(factura.saldo) - cubre });
      await supabase().from("facturas").update({ reservada_rapel: true }).eq("id", factura.id);
    }
    setRapelId(creado.data.id);
    setMensaje("Rapel en borrador. Esas facturas salen de pendientes. Su estado visible es Pendiente.");
  }

  async function cerrar() {
    if (!rapelId) { setMensaje("Primero arme el rapel."); return; }
    if (cierre.diferenciaAPagar > 0) {
      const pago = await supabase().from("pagos").insert({
        empresa_id: empresaId, proveedor_id: proveedorId, fecha: hoySantiago(), monto: cierre.diferenciaAPagar, medio: "transferencia", observacion: "Diferencia a pagar del rapel", es_abono: false,
      }).select("id").single();
      if (pago.error) { setMensaje(pago.error.message); return; }
    }
    for (const factura of elegidas) {
      await supabase().from("facturas").update({ abonado: Number(factura.total_oficial), reservada_rapel: false, con_rapel: true }).eq("id", factura.id);
    }
    await supabase().from("rapeles").update({ saldo: 0, estado: "aplicado" }).eq("id", rapelId);
    setMensaje("Las facturas quedaron Pagado con Rapel y el saldo del rapel quedó en cero.");
    setFacturas(facturas.filter((factura) => !marcadas.includes(factura.id)));
    setMarcadas([]);
    setRapelId("");
  }

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="marco">
        <h1 className="titulo-barra">Rapel</h1>
        <div className="overflow-auto">
          <table className="tabla">
            <thead><tr><th></th><th>Fecha</th><th>Factura</th><th>Saldo</th></tr></thead>
            <tbody>
              {facturas.map((factura) => (
                <tr key={factura.id}>
                  <td><input className="w-auto" type="checkbox" checked={marcadas.includes(factura.id)} onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, factura.id] : marcadas.filter((id) => id !== factura.id))} /></td>
                  <td>{fechaCorta(factura.fecha_ingreso)}</td><td>{factura.numero}</td><td>{formatoPeso(factura.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="marco space-y-3 p-3">
        <label className="campo"><span className="etiqueta">Proveedor</span>
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Seleccione</option>
            {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.rapel_activo ? "" : " (sin rapel)"}</option>)}
          </select>
        </label>
        <label className="campo"><span className="etiqueta">Monto del rapel</span><input inputMode="numeric" placeholder="$ 0" value={monto} onChange={(e) => setMonto(textoMonto(e.target.value))} /></label>
        <p>Facturas {formatoPeso(cierre.suma)}</p>
        <p className="text-lg font-semibold text-[#2436F0]">Diferencia a pagar {formatoPeso(cierre.diferenciaAPagar)}</p>
        {mensaje && <p className="aviso">{mensaje}</p>}
        <button className="btn w-full" onClick={() => void armar()}>Armar rapel</button>
        <button className="btn btn-solido w-full" onClick={() => void cerrar()}>Registrar pago de la diferencia</button>
      </aside>
    </div>
  );
}
