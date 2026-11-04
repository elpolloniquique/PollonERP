"use client";

import { useEffect, useState } from "react";
import { Perfil, supabase } from "@/lib/supabase";

type Usuario = { id: string; nombre: string; rol: Perfil["rol"]; empresa_id: string | null; puede_ver: boolean; puede_crear: boolean; puede_modificar: boolean; puede_eliminar: boolean };

export default function Usuarios() {
  const [yo, setYo] = useState<Perfil | null>(null);
  const [lista, setLista] = useState<Usuario[]>([]);
  const [error, setError] = useState("");

  async function cargar() {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("*").eq("id", usuario.user.id).single();
    const actual = perfil.data as Perfil | null;
    setYo(actual);
    if (!actual?.empresa_id) return;
    const { data } = await supabase().from("perfiles").select("id, nombre, rol, empresa_id, puede_ver, puede_crear, puede_modificar, puede_eliminar").or(`empresa_id.eq.${actual.empresa_id},empresa_id.is.null`);
    setLista((data ?? []) as Usuario[]);
  }

  useEffect(() => { void cargar(); }, []);

  if (yo && yo.rol === "operador") return <main className="p-4"><p className="aviso">Un operador no administra usuarios.</p></main>;

  async function asignar(usuario: Usuario, rol: Perfil["rol"]) {
    if (!yo?.empresa_id) return;
    const operador = rol === "operador";
    const { error: fallo } = await supabase().from("perfiles").update({
      empresa_id: yo.empresa_id,
      rol,
      puede_ver: true,
      puede_crear: true,
      puede_modificar: true,
      puede_eliminar: !operador,
    }).eq("id", usuario.id);
    if (fallo) { setError(fallo.message); return; }
    await cargar();
  }

  return (
    <div className="h-full overflow-auto p-3">
      <section className="marco">
        <h1 className="titulo-barra">Usuarios y roles</h1>
        <p className="p-3 text-[#3e5552]">Quien necesite entrar crea su cuenta en la pantalla de ingreso. Después aparece aquí para asignarle la empresa y el rol. No hay clave maestra.</p>
        {error && <p className="error mx-3">{error}</p>}
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Empresa</th><th></th></tr></thead>
          <tbody>
            {lista.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nombre}</td>
                <td>{usuario.rol === "superadmin" ? "Super administrador" : usuario.rol === "administrador" ? "Administrador" : "Operador"}</td>
                <td>{usuario.empresa_id ? "Asignada" : "Sin empresa"}</td>
                <td className="flex gap-2">
                  {usuario.id !== yo?.id && <button className="btn" onClick={() => asignar(usuario, "administrador")}>Administrador</button>}
                  {usuario.id !== yo?.id && <button className="btn" onClick={() => asignar(usuario, "operador")}>Operador</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
