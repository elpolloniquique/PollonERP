import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function configurado() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

let cliente: SupabaseClient | null = null;

export function supabase() {
  if (!cliente) {
    cliente = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
  }
  return cliente;
}

export type Perfil = {
  id: string;
  empresa_id: string | null;
  nombre: string;
  rol: "superadmin" | "administrador" | "operador";
  puede_ver: boolean;
  puede_crear: boolean;
  puede_modificar: boolean;
  puede_eliminar: boolean;
};

export type Empresa = {
  id: string;
  nombre_comercial: string;
  razon_social: string;
  rut: string;
  giro: string;
  direccion: string;
  telefono: string;
  correo: string;
  tolerancia_pesos: number;
  porcentaje_iva: number;
};
