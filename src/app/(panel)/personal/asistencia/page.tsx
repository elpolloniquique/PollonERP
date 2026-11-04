"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hoySantiago } from "@/lib/fechas";
import { Perfil, supabase } from "@/lib/supabase";

const TIPOS = ["entrada", "salida", "atraso", "inasistencia", "permiso", "vacaciones", "licencia", "feriado"];
type Trabajador = { id: string; nombre: string };
type Marca = { id: string; trabajador_id: string; fecha: string; tipo: string; hora: string | null };

export default function Asistencia() {
  const hoy = hoySantiago();
  const [empresaId, setEmpresaId] = useState("");
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [trabajadorId, setTrabajadorId] = useState("");
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [tipo, setTipo] = useState("entrada");
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState("08:00");

  async function cargar(id = empresaId, periodo = mes) {
    const { data } = await supabase().from("asistencia").select("id, trabajador_id, fecha, tipo, hora").eq("empresa_id", id).gte("fecha", `${periodo}-01`).lte("fecha", `${periodo}-31`);
    setMarcas((data ?? []) as Marca[]);
  }

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
      const id = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id ?? "";
      setEmpresaId(id);
      const lista = await supabase().from("trabajadores").select("id, nombre").eq("empresa_id", id).eq("activo", true).order("nombre");
      setTrabajadores((lista.data ?? []) as Trabajador[]);
      await cargar(id, mes);
    })();
    const canal = supabase().channel("asistencia").on("postgres_changes", { event: "*", schema: "public", table: "asistencia" }, () => void cargar()).subscribe();
    return () => { void supabase().removeChannel(canal); };
  }, []);

  const llegaron = new Set(marcas.filter((marca) => marca.fecha === hoy && marca.tipo === "entrada").map((marca) => marca.trabajador_id));
  const delMes = marcas.filter((marca) => marca.trabajador_id === trabajadorId);

  async function marcar() {
    const { error } = await supabase().from("asistencia").upsert({
      empresa_id: empresaId, trabajador_id: trabajadorId, fecha, tipo, hora: hora || null,
    }, { onConflict: "trabajador_id,fecha,tipo" });
    if (!error) await cargar();
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-2"><Link className="btn" href="/personal">Trabajadores</Link><h1 className="text-lg font-semibold">Asistencia</h1></div>
      <section className="marco p-3">
        <h2 className="font-semibold">Hoy</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <p>Llegaron: {trabajadores.filter((item) => llegaron.has(item.id)).map((item) => item.nombre).join(", ") || "Nadie todavía"}</p>
          <p>Faltan: {trabajadores.filter((item) => !llegaron.has(item.id)).map((item) => item.nombre).join(", ") || "Todos marcaron entrada"}</p>
        </div>
      </section>
      <div className="grid gap-2 md:grid-cols-5">
        <select value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}><option value="">Trabajador</option>{trabajadores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <input type="month" value={mes} onChange={(e) => { setMes(e.target.value); void cargar(empresaId, e.target.value); }} />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map((item) => <option key={item}>{item}</option>)}</select>
        <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </div>
      <button className="btn btn-solido" disabled={!trabajadorId} onClick={() => void marcar()}>Registrar marca</button>
      <div className="marco overflow-auto">
        <table className="tabla">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Hora</th></tr></thead>
          <tbody>{delMes.map((marca) => <tr key={marca.id}><td>{marca.fecha}</td><td>{marca.tipo}</td><td>{marca.hora ?? ""}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
