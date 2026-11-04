"use client";

import { useEffect, useMemo, useState } from "react";
import { hoySantiago } from "@/lib/fechas";
import { estadoVisible, formatoPeso } from "@/lib/formato";
import { excelListado, pdfListado, type FilaListado } from "@/lib/exportar";
import { fechaCorta } from "@/lib/fechas";
import { Perfil, supabase } from "@/lib/supabase";

type Fila = FilaListado & { id: string; proveedor_id: string };

export default function Listado() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [estado, setEstado] = useState("");
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [soloSaldo, setSoloSaldo] = useState(false);
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [motivo, setMotivo] = useState("");
  const [anularId, setAnularId] = useState("");
  const [puedeEliminar, setPuedeEliminar] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("*").eq("id", usuario.user.id).single();
      const actual = perfil.data as Perfil | null;
      if (!actual?.empresa_id) return;
      setPuedeEliminar(actual.puede_eliminar);
      const [facts, provs] = await Promise.all([
        supabase().from("facturas").select("id, proveedor_id, numero, fecha_ingreso, neto_calculado, iva_calculado, total_oficial, saldo, estado, con_rapel, proveedores(nombre)").eq("empresa_id", actual.empresa_id).order("fecha_ingreso"),
        supabase().from("proveedores").select("id, nombre").eq("empresa_id", actual.empresa_id).order("nombre"),
      ]);
      const simples = facts.error
        ? await supabase().from("facturas").select("id, proveedor_id, numero, fecha_ingreso, neto_calculado, iva_calculado, total_oficial, saldo, estado, proveedores(nombre)").eq("empresa_id", actual.empresa_id).order("fecha_ingreso")
        : facts;
      setProveedores((provs.data ?? []) as { id: string; nombre: string }[]);
      setFilas(((simples.data ?? []) as Record<string, unknown>[]).map((fila) => {
        const proveedor = Array.isArray(fila.proveedores) ? fila.proveedores[0] : fila.proveedores;
        return {
          id: String(fila.id),
          proveedor_id: String(fila.proveedor_id),
          proveedor: (proveedor as { nombre?: string } | null)?.nombre ?? "",
          numero: String(fila.numero),
          fecha_ingreso: String(fila.fecha_ingreso),
          neto_calculado: Number(fila.neto_calculado),
          iva_calculado: Number(fila.iva_calculado),
          total_oficial: Number(fila.total_oficial),
          saldo: Number(fila.saldo),
          estado: String(fila.estado),
          con_rapel: Boolean(fila.con_rapel),
        };
      }));
    })();
  }, []);

  const rango = useMemo(() => {
    const hoy = hoySantiago();
    if (!desde && !hasta) return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy };
    return { desde: desde || "2000-01-01", hasta: hasta || hoy };
  }, [desde, hasta]);

  const visibles = filas.filter((fila) => {
    if (proveedorId && fila.proveedor_id !== proveedorId) return false;
    if (estado && fila.estado !== estado) return false;
    if (soloSaldo && Number(fila.saldo) <= 0) return false;
    if (texto && !`${fila.numero} ${fila.proveedor}`.toLowerCase().includes(texto.toLowerCase())) return false;
    return fila.fecha_ingreso >= rango.desde && fila.fecha_ingreso <= rango.hasta;
  });

  async function anular() {
    if (!puedeEliminar) { setAviso("No tiene permiso para anular."); return; }
    if (!motivo.trim()) { setAviso("Escriba el motivo."); return; }
    const { error } = await supabase().from("facturas").update({ estado: "anulada", motivo_anulacion: motivo.trim() }).eq("id", anularId);
    if (error) { setAviso(error.message); return; }
    setFilas(filas.map((fila) => fila.id === anularId ? { ...fila, estado: "anulada", saldo: 0 } : fila));
    setAnularId("");
    setMotivo("");
  }

  return (
    <div className="space-y-3 p-3">
      <h1 className="titulo-barra">Listado de facturas</h1>
      <div className="grid gap-2 md:grid-cols-6">
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}><option value="">Todos los proveedores</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Estado</option><option value="pendiente">Pendiente</option><option value="pago_parcial">Pago parcial</option><option value="pagada">Pagada</option><option value="anulada">Anulada</option></select>
        <input placeholder="Texto" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={soloSaldo} onChange={(e) => setSoloSaldo(e.target.checked)} />Solo con saldo</label>
      </div>
      <p className="text-[#5c6478]">Periodo {fechaCorta(rango.desde)} al {fechaCorta(rango.hasta)}. Sin fechas, el rango es el año en curso.</p>
      <div className="marco overflow-auto">
        <table className="tabla">
          <thead><tr><th>Ingreso</th><th>Número</th><th>Neto</th><th>IVA</th><th>Total</th><th>Saldo</th><th>Estado</th></tr></thead>
          <tbody>
            {visibles.map((fila) => (
              <tr key={fila.id} onDoubleClick={() => { window.location.href = `/facturas/${fila.id}`; }}>
                <td>{fechaCorta(fila.fecha_ingreso)}</td><td>{fila.numero}</td><td>{formatoPeso(fila.neto_calculado)}</td><td>{formatoPeso(fila.iva_calculado)}</td><td>{formatoPeso(fila.total_oficial)}</td><td>{formatoPeso(fila.saldo)}</td><td>{estadoVisible(fila.estado, fila.con_rapel)} {puedeEliminar && fila.estado !== "anulada" && <button className="btn" onClick={() => setAnularId(fila.id)}>Anular</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>Cantidad {visibles.length}. Total {formatoPeso(visibles.reduce((s, f) => s + Number(f.total_oficial), 0))}. Pendiente {formatoPeso(visibles.reduce((s, f) => s + Number(f.saldo), 0))}. Pagado {formatoPeso(visibles.reduce((s, f) => s + Number(f.total_oficial) - Number(f.saldo), 0))}.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => void excelListado(visibles, `${rango.desde} a ${rango.hasta}`)}>Excel</button>
        <button className="btn" onClick={() => void pdfListado(visibles, `${rango.desde} a ${rango.hasta}`)}>PDF</button>
      </div>
      {anularId && (
        <div className="marco max-w-md space-y-2 p-3">
          <p>Motivo de anulación</p>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button className="btn btn-peligro" onClick={() => void anular()}>Confirmar anulación</button>
        </div>
      )}
      {aviso && <p className="aviso">{aviso}</p>}
    </div>
  );
}
