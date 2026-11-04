"use client";

import { useEffect, useState } from "react";
import { fechaCorta } from "@/lib/fechas";
import { formatoPeso } from "@/lib/formato";
import { Perfil, supabase } from "@/lib/supabase";

type Fila = { id: string; numero: string; fecha_ingreso: string; total_oficial: number; saldo: number; proveedor: string };

export default function Parciales() {
  const [filas, setFilas] = useState<Fila[]>([]);
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
      const { data } = await supabase().from("facturas").select("id, numero, fecha_ingreso, total_oficial, saldo, proveedores(nombre)").eq("empresa_id", actual.empresa_id).eq("estado", "pago_parcial").order("fecha_ingreso");
      setFilas(((data ?? []) as Record<string, unknown>[]).map((fila) => {
        const proveedor = Array.isArray(fila.proveedores) ? fila.proveedores[0] : fila.proveedores;
        return { id: String(fila.id), numero: String(fila.numero), fecha_ingreso: String(fila.fecha_ingreso), total_oficial: Number(fila.total_oficial), saldo: Number(fila.saldo), proveedor: (proveedor as { nombre?: string } | null)?.nombre ?? "" };
      }));
    })();
  }, []);

  return (
    <div className="space-y-3 p-3">
      <h1 className="titulo-barra">Pago parcial</h1>
      <p className="text-[#5c6478]">Solo consulta. Desde aquí se abre o se anula la factura. El pago se registra en Registrar pago o Abono parcial.</p>
      <div className="marco overflow-auto">
        <table className="tabla">
          <thead><tr><th>Proveedor</th><th>Fecha</th><th>Factura</th><th>Total</th><th>Saldo</th><th></th></tr></thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.id}>
                <td>{fila.proveedor}</td><td>{fechaCorta(fila.fecha_ingreso)}</td><td>{fila.numero}</td><td>{formatoPeso(fila.total_oficial)}</td><td>{formatoPeso(fila.saldo)}</td>
                <td className="flex gap-2">
                  <a className="btn" href={`/facturas/${fila.id}`}>Abrir</a>
                  {puedeEliminar && <button className="btn btn-peligro" onClick={() => setAnularId(fila.id)}>Anular</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {anularId && (
        <div className="marco max-w-md space-y-2 p-3">
          <input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <button className="btn btn-peligro" onClick={async () => {
            if (!motivo.trim()) { setAviso("Escriba el motivo."); return; }
            const { error } = await supabase().from("facturas").update({ estado: "anulada", motivo_anulacion: motivo.trim() }).eq("id", anularId);
            if (error) { setAviso(error.message); return; }
            setFilas(filas.filter((fila) => fila.id !== anularId));
            setAnularId("");
          }}>Confirmar anulación</button>
          {aviso && <p className="aviso">{aviso}</p>}
        </div>
      )}
    </div>
  );
}
