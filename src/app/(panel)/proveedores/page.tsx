"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatoPeso } from "@/lib/formato";
import { mostrarRut } from "@/lib/rut";
import { Perfil, supabase } from "@/lib/supabase";

type Fila = { id: string; nombre: string; rut: string; activo: boolean; rapel_activo: boolean; saldo: number };

export default function Proveedores() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [verInactivos, setVerInactivos] = useState(false);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
      const empresaId = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
      if (!empresaId) return;
      const [proveedores, facturas] = await Promise.all([
        supabase().from("proveedores").select("id, nombre, rut, activo, rapel_activo").eq("empresa_id", empresaId).order("nombre"),
        supabase().from("facturas").select("proveedor_id, saldo").eq("empresa_id", empresaId).in("estado", ["pendiente", "pago_parcial"]),
      ]);
      const saldos = new Map<string, number>();
      for (const factura of facturas.data ?? []) {
        const id = factura.proveedor_id as string;
        saldos.set(id, (saldos.get(id) ?? 0) + Number(factura.saldo));
      }
      setFilas(((proveedores.data ?? []) as Omit<Fila, "saldo">[]).map((fila) => ({ ...fila, saldo: saldos.get(fila.id) ?? 0 })));
    })();
  }, []);

  const visibles = filas.filter((fila) => (verInactivos || fila.activo) && fila.nombre.toLowerCase().includes(texto.toLowerCase()));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="min-w-0 flex-1 sm:max-w-xs" placeholder="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />Inactivos</label>
        <Link className="btn w-full text-center sm:ml-auto sm:w-auto" href="/proveedores/nuevo">Nuevo proveedor</Link>
      </div>
      <div className="marco min-h-0 flex-1 overflow-auto">
        <div className="tabla-scroll escritorio-solo">
          <table className="tabla min-w-[640px]">
            <thead><tr><th>Nombre</th><th>RUT</th><th>Estado</th><th>Rapel</th><th className="text-right">Saldo</th></tr></thead>
            <tbody>
              {visibles.length === 0 && <tr><td colSpan={5}>No hay proveedores con este filtro.</td></tr>}
              {visibles.map((fila) => (
                <tr key={fila.id} onDoubleClick={() => { window.location.href = `/proveedores/${fila.id}`; }}>
                  <td><Link href={`/proveedores/${fila.id}`}>{fila.nombre}</Link></td>
                  <td className="nowrap">{fila.rut ? mostrarRut(fila.rut) : ""}</td>
                  <td>{fila.activo ? "Activo" : "Inactivo"}</td>
                  <td>{fila.rapel_activo ? "Sí" : "No"}</td>
                  <td className="text-right nowrap">{formatoPeso(fila.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lista-cartas movil-solo p-3">
          {visibles.length === 0 && <p className="pendientes-vacio">No hay proveedores con este filtro.</p>}
          {visibles.map((fila) => (
            <Link key={fila.id} href={`/proveedores/${fila.id}`} className="carta-factura no-underline">
              <div className="carta-factura-arriba">
                <span className="carta-factura-numero">{fila.nombre}</span>
                <span className="carta-factura-estado">{fila.activo ? "Activo" : "Inactivo"}</span>
              </div>
              <div className="carta-factura-abajo">
                <span>{fila.rut ? mostrarRut(fila.rut) : "Sin RUT"}{fila.rapel_activo ? " · Rapel" : ""}</span>
                <strong>{formatoPeso(fila.saldo)}</strong>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
