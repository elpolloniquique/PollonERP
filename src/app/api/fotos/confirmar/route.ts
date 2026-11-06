import { NextResponse } from "next/server";
import { descartarFoto, grabarFoto } from "@/lib/facturaFoto";
import { supabaseConSesion, tokenDe } from "@/lib/supabaseServidor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = tokenDe(request);
  if (!token) return NextResponse.json({ error: "Debe iniciar sesión." }, { status: 401 });
  const cuerpo = await request.json().catch(() => null) as { id?: string; accion?: string } | null;
  const id = cuerpo?.id ?? "";
  const accion = (cuerpo?.accion ?? "").toLowerCase();
  if (!id || (accion !== "si" && accion !== "no")) {
    return NextResponse.json({ error: "Indique la foto y si la confirma." }, { status: 400 });
  }
  try {
    const db = supabaseConSesion(token);
    const { data: usuario } = await db.auth.getUser(token);
    if (!usuario.user) return NextResponse.json({ error: "La sesión no es válida." }, { status: 401 });
    if (accion === "no") {
      await descartarFoto(db, id);
      return NextResponse.json({ ok: true, mensaje: "Foto descartada. No se grabó la factura." });
    }
    const mensaje = await grabarFoto(db, id);
    return NextResponse.json({ ok: true, mensaje });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo grabar.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
