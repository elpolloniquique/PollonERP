"use client";

import { useEffect, useState } from "react";
import { Perfil, supabase } from "@/lib/supabase";

type Foto = { id: string; ruta: string; origen: string; estado: string; rut_leido: string; numero: string; fecha: string | null; neto: number; iva: number; total: number; cierra: boolean; resumen: string; proveedor_id: string | null };
type Proveedor = { id: string; nombre: string; rut: string };

export default function Fotos() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [imagen, setImagen] = useState("");
  const [elegida, setElegida] = useState<Foto | null>(null);
  const [aviso, setAviso] = useState("");

  async function cargar() {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!empresaId) return;
    const [lista, provs] = await Promise.all([
      supabase().from("fotos_factura").select("*").eq("empresa_id", empresaId).order("creado_en", { ascending: false }),
      supabase().from("proveedores").select("id, nombre, rut").eq("empresa_id", empresaId).order("nombre"),
    ]);
    if (lista.error) { setAviso("Ejecute supabase/modulos.sql para abrir la bandeja de fotos."); return; }
    setFotos((lista.data ?? []) as Foto[]);
    setProveedores((provs.data ?? []) as Proveedor[]);
  }

  useEffect(() => { void cargar(); }, []);

  async function ver(foto: Foto) {
    setElegida(foto);
    const firmada = await supabase().storage.from("facturas-fotos").createSignedUrl(foto.ruta, 120);
    setImagen(firmada.data?.signedUrl ?? "");
  }

  async function confirmar() {
    if (!elegida) return;
    if (!elegida.cierra) { setAviso("La lectura no cierra neto, IVA y total. Corrija antes de confirmar."); return; }
    if (!elegida.proveedor_id) { setAviso("Asigne el proveedor. La foto se conserva."); return; }
    const { error } = await supabase().from("fotos_factura").update({
      numero: elegida.numero, proveedor_id: elegida.proveedor_id, estado: "confirmada",
    }).eq("id", elegida.id);
    if (error) { setAviso(error.message); return; }
    setAviso("Foto confirmada. Abra Nueva factura para grabarla con las reglas de crédito, o responda SI en Telegram si llegó por ahí.");
    await cargar();
  }

  return (
    <div className="grid gap-3 p-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="marco max-h-[70dvh] overflow-auto">
        <h1 className="titulo-barra">Bandeja de fotos</h1>
        {fotos.map((foto) => (
          <button key={foto.id} className="block w-full border-b border-[var(--linea)] px-3 py-2 text-left" onClick={() => void ver(foto)}>
            <strong>{foto.numero || "Sin número"}</strong>
            <span className="block text-[#5c6478]">{foto.origen} · {foto.estado}</span>
          </button>
        ))}
      </aside>
      {elegida && (
        <section className="marco space-y-3 p-3">
          {imagen && <img src={imagen} alt="Factura fotografiada" className="max-h-80 w-full object-contain" />}
          <pre className="whitespace-pre-wrap text-[#5c6478]">{elegida.resumen}</pre>
          <label className="campo"><span className="etiqueta">Número</span><input value={elegida.numero} onChange={(e) => setElegida({ ...elegida, numero: e.target.value })} /></label>
          <label className="campo"><span className="etiqueta">Proveedor</span>
            <select value={elegida.proveedor_id ?? ""} onChange={(e) => setElegida({ ...elegida, proveedor_id: e.target.value })}>
              <option value="">Sin asignar</option>
              {proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <p>Falta: {!elegida.proveedor_id ? "proveedor. " : ""}{!elegida.cierra ? "que neto, IVA y total cierren." : "Nada. Se puede confirmar."}</p>
          <button className="btn btn-solido" onClick={() => void confirmar()}>Confirmar</button>
          {aviso && <p className="aviso">{aviso}</p>}
        </section>
      )}
    </div>
  );
}
