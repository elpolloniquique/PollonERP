import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseServicio(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseConSesion(token: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function tokenDe(request: Request): string {
  const encabezado = request.headers.get("authorization") ?? "";
  return encabezado.toLowerCase().startsWith("bearer ") ? encabezado.slice(7).trim() : "";
}
