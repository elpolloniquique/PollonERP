"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError("");
    setAviso("");
    setOcupado(true);
    const auth = supabase().auth;
    const resultado = alta
      ? await auth.signUp({ email: correo.trim(), password: clave, options: { data: { nombre: nombre.trim() } } })
      : await auth.signInWithPassword({ email: correo.trim(), password: clave });
    setOcupado(false);
    if (resultado.error) {
      setError(resultado.error.message);
      return;
    }
    if (alta && !resultado.data.session) {
      setAviso("Cuenta creada. Si Supabase pide confirmar el correo, ábralo y vuelva a entrar.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={enviar} className="marco w-[380px] max-w-full">
        <div className="flex flex-col items-center gap-2 px-6 pt-6">
          <img src="/icon.svg" alt="SG" width={72} height={72} />
          <p className="text-sm font-semibold text-[#2436F0]">SG Proveedores</p>
        </div>
        <div className="space-y-3 px-6 py-5">
          {alta && (
            <label className="campo">
              <span className="etiqueta">Nombre</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </label>
          )}
          <label className="campo">
            <span className="etiqueta">Correo</span>
            <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
          </label>
          <label className="campo">
            <span className="etiqueta">Clave</span>
            <input type="password" autoComplete={alta ? "new-password" : "current-password"} value={clave} onChange={(e) => setClave(e.target.value)} required minLength={6} />
          </label>
          {error && <p className="error">{error}</p>}
          {aviso && <p className="aviso">{aviso}</p>}
          <button className="btn btn-solido w-full" disabled={ocupado}>{ocupado ? "Espere" : alta ? "Crear cuenta" : "Entrar"}</button>
          <button type="button" className="btn w-full" onClick={() => { setAlta(!alta); setError(""); }}>
            {alta ? "Ya tengo cuenta" : "Crear la primera cuenta"}
          </button>
        </div>
      </form>
    </main>
  );
}
