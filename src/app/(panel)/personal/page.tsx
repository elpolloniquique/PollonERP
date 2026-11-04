"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { mostrarRut, normalizarRut } from "@/lib/rut";
import { formatoPeso } from "@/lib/formato";
import { Perfil, supabase } from "@/lib/supabase";

type Trabajador = {
  id?: string; empresa_id: string; rut: string; nombre: string; cargo: string; area: string; fecha_ingreso: string;
  jornada: string; sueldo_base: number; forma_pago: string; banco: string; numero_cuenta: string; activo: boolean;
};

const vacio = (empresaId: string): Trabajador => ({
  empresa_id: empresaId, rut: "", nombre: "", cargo: "", area: "", fecha_ingreso: new Date().toISOString().slice(0, 10),
  jornada: "Completa", sueldo_base: 0, forma_pago: "transferencia", banco: "", numero_cuenta: "", activo: true,
});

export default function Personal() {
  const [empresaId, setEmpresaId] = useState("");
  const [lista, setLista] = useState<Trabajador[]>([]);
  const [ficha, setFicha] = useState<Trabajador | null>(null);
  const [aviso, setAviso] = useState("");

  async function cargar(id = empresaId) {
    const { data, error } = await supabase().from("trabajadores").select("*").eq("empresa_id", id).order("nombre");
    if (error) { setAviso("Ejecute supabase/modulos.sql para abrir el personal."); return; }
    setLista((data ?? []) as Trabajador[]);
  }

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
      const id = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id ?? "";
      setEmpresaId(id);
      await cargar(id);
    })();
  }, []);

  async function guardar() {
    if (!ficha) return;
    const rut = normalizarRut(ficha.rut);
    if ("error" in rut) { setAviso(rut.error); return; }
    const cuerpo = { ...ficha, rut: rut.guardado, sueldo_base: Number(ficha.sueldo_base) };
    const { id, ...resto } = cuerpo;
    const consulta = id
      ? supabase().from("trabajadores").update(resto).eq("id", id)
      : supabase().from("trabajadores").insert(resto);
    const { error } = await consulta;
    if (error) { setAviso(error.message); return; }
    setFicha(null);
    await cargar();
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Personal</h1>
        <Link className="btn" href="/personal/asistencia">Asistencia</Link>
        <Link className="btn" href="/personal/liquidacion">Liquidación</Link>
        <Link className="btn" href="/personal/parametros">Parámetros del año</Link>
        <button className="btn btn-solido ml-auto" onClick={() => setFicha(vacio(empresaId))}>Nuevo trabajador</button>
      </div>
      {aviso && <p className="aviso">{aviso}</p>}
      <div className="marco overflow-auto">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>RUT</th><th>Cargo</th><th>Área</th><th>Sueldo</th><th>Estado</th></tr></thead>
          <tbody>
            {lista.map((item) => (
              <tr key={item.id} onClick={() => setFicha(item)}>
                <td>{item.nombre}</td><td>{mostrarRut(item.rut)}</td><td>{item.cargo}</td><td>{item.area}</td><td>{formatoPeso(item.sueldo_base)}</td><td>{item.activo ? "Activo" : "Desactivado"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ficha && (
        <section className="marco space-y-3 p-3">
          <div className="grilla-campos">
            <label className="campo"><span className="etiqueta">Nombre</span><input value={ficha.nombre} onChange={(e) => setFicha({ ...ficha, nombre: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">RUT</span><input value={ficha.rut} onChange={(e) => setFicha({ ...ficha, rut: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">Cargo</span><input value={ficha.cargo} onChange={(e) => setFicha({ ...ficha, cargo: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">Área</span><input value={ficha.area} onChange={(e) => setFicha({ ...ficha, area: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">Ingreso</span><input type="date" value={ficha.fecha_ingreso} onChange={(e) => setFicha({ ...ficha, fecha_ingreso: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">Jornada</span><input value={ficha.jornada} onChange={(e) => setFicha({ ...ficha, jornada: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">Sueldo base</span><input value={ficha.sueldo_base} onChange={(e) => setFicha({ ...ficha, sueldo_base: Number(e.target.value) })} /></label>
            <label className="campo"><span className="etiqueta">Forma de pago</span><input value={ficha.forma_pago} onChange={(e) => setFicha({ ...ficha, forma_pago: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">Banco</span><input value={ficha.banco} onChange={(e) => setFicha({ ...ficha, banco: e.target.value })} /></label>
            <label className="campo"><span className="etiqueta">Cuenta</span><input value={ficha.numero_cuenta} onChange={(e) => setFicha({ ...ficha, numero_cuenta: e.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={ficha.activo} onChange={(e) => setFicha({ ...ficha, activo: e.target.checked })} />Activo</label>
          <div className="flex gap-2">
            <button className="btn btn-solido" onClick={() => void guardar()}>Guardar</button>
            {ficha.id && <button className="btn" onClick={() => void supabase().from("trabajadores").update({ activo: false }).eq("id", ficha.id).then(() => cargar())}>Desactivar</button>}
          </div>
        </section>
      )}
    </div>
  );
}
