"use client";

import { useEffect, useState } from "react";
import { formatoPeso } from "@/lib/formato";
import { supabase } from "@/lib/supabase";

type Foto = {
  id: string;
  ruta: string;
  origen: string;
  estado: string;
  rut_leido: string;
  numero: string;
  fecha: string | null;
  neto: number;
  iva: number;
  total: number;
  cierra: boolean;
  resumen: string;
  proveedor_id: string | null;
};

async function autorizacion() {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Debe iniciar sesión.");
  return { Authorization: `Bearer ${token}` };
}

export default function Fotos() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [imagen, setImagen] = useState("");
  const [elegida, setElegida] = useState<Foto | null>(null);
  const [aviso, setAviso] = useState("");
  const [leyendo, setLeyendo] = useState(false);

  async function cargar() {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = perfil.data?.empresa_id;
    if (!empresaId) return;
    const lista = await supabase().from("fotos_factura").select("*").eq("empresa_id", empresaId).order("creado_en", { ascending: false });
    if (lista.error) {
      setAviso("Ejecute supabase/modulos.sql y supabase/fotos-lectura.sql en Supabase.");
      return;
    }
    setFotos((lista.data ?? []) as Foto[]);
  }

  useEffect(() => { void cargar(); }, []);

  async function ver(foto: Foto) {
    setElegida(foto);
    setAviso("");
    const firmada = await supabase().storage.from("facturas-fotos").createSignedUrl(foto.ruta, 120);
    setImagen(firmada.data?.signedUrl ?? "");
  }

  async function leer(archivo: File) {
    setLeyendo(true);
    setAviso("");
    setElegida(null);
    try {
      const datos = new FormData();
      datos.append("foto", archivo);
      const respuesta = await fetch("/api/fotos/leer", { method: "POST", headers: await autorizacion(), body: datos });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error ?? "No se pudo leer la foto.");
      await cargar();
      await ver(cuerpo.foto as Foto);
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "No se pudo leer la foto.");
    } finally {
      setLeyendo(false);
    }
  }

  async function confirmar(accion: "si" | "no") {
    if (!elegida) return;
    setAviso("");
    try {
      const respuesta = await fetch("/api/fotos/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await autorizacion()) },
        body: JSON.stringify({ id: elegida.id, accion }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error ?? "No se pudo confirmar.");
      setAviso(cuerpo.mensaje);
      setElegida({ ...elegida, estado: accion === "si" ? "confirmada" : "descartada" });
      await cargar();
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "No se pudo confirmar.");
    }
  }

  const puedeGrabar = Boolean(elegida && elegida.estado === "borrador" && elegida.cierra && elegida.proveedor_id && elegida.numero);

  return (
    <div className="foto-pantalla">
      <section className="foto-panel">
        <h1 className="titulo-barra">Fotos de facturas</h1>
        <div className="foto-cuerpo">
          <aside className="foto-lista">
            <label className="btn btn-solido foto-tomar">
              {leyendo ? "Leyendo…" : "Tomar foto"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={leyendo}
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  e.target.value = "";
                  if (archivo) void leer(archivo);
                }}
              />
            </label>
            <label className="btn foto-tomar">
              Elegir foto o PDF
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={leyendo}
                onChange={(e) => {
                  const archivo = e.target.files?.[0];
                  e.target.value = "";
                  if (archivo) void leer(archivo);
                }}
              />
            </label>
            <div className="foto-lista-scroll">
              {fotos.length === 0 && <p className="pendientes-vacio">Todavía no hay fotos.</p>}
              {fotos.map((foto) => (
                <button key={foto.id} type="button" className={`foto-item ${elegida?.id === foto.id ? "activa" : ""}`} onClick={() => void ver(foto)}>
                  <strong>{foto.numero || "Sin número"}</strong>
                  <span>{foto.origen} · {foto.estado}</span>
                  <em>{formatoPeso(Number(foto.total))}</em>
                </button>
              ))}
            </div>
          </aside>

          <div className="foto-detalle">
            {!elegida && <p className="pendientes-vacio">Tome una foto de la factura. El sistema lee el total y solo la graba cuando confirme.</p>}
            {elegida && (
              <>
                {imagen && <img src={imagen} alt="Factura fotografiada" className="foto-vista" />}
                <pre className="foto-resumen">{elegida.resumen}</pre>
                {elegida.estado === "borrador" && (
                  <div className="foto-acciones">
                    <button type="button" className="btn btn-solido" disabled={!puedeGrabar} onClick={() => void confirmar("si")}>SI, grabar</button>
                    <button type="button" className="btn" onClick={() => void confirmar("no")}>NO</button>
                  </div>
                )}
              </>
            )}
            {aviso && <p className="aviso">{aviso}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
