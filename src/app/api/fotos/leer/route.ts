import { NextResponse } from "next/server";
import { guardarLectura } from "@/lib/facturaFoto";
import { supabaseConSesion, tokenDe } from "@/lib/supabaseServidor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = tokenDe(request);
  if (!token) return NextResponse.json({ error: "Debe iniciar sesión." }, { status: 401 });
  const formulario = await request.formData();
  const archivo = formulario.get("foto");
  if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta la foto." }, { status: 400 });
  const mime = archivo.type || "image/jpeg";
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    return NextResponse.json({ error: "Envíe una foto o un PDF." }, { status: 400 });
  }
  try {
    const db = supabaseConSesion(token);
    const { data: usuario } = await db.auth.getUser(token);
    if (!usuario.user) return NextResponse.json({ error: "La sesión no es válida." }, { status: 401 });
    const perfil = await db.from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = perfil.data?.empresa_id as string | undefined;
    if (!empresaId) return NextResponse.json({ error: "Su usuario no tiene empresa." }, { status: 400 });
    const empresa = await db.from("empresas").select("tolerancia_pesos").eq("id", empresaId).single();
    const bytes = Buffer.from(await archivo.arrayBuffer());
    const extension = mime === "application/pdf" ? "pdf" : "jpg";
    const ruta = `${empresaId}/${crypto.randomUUID()}.${extension}`;
    const subida = await db.storage.from("facturas-fotos").upload(ruta, bytes, { contentType: mime });
    if (subida.error) return NextResponse.json({ error: subida.error.message }, { status: 400 });
    const resultado = await guardarLectura(db, {
      empresaId,
      ruta,
      origen: "camara",
      bytes,
      mime,
      tolerancia: Number(empresa.data?.tolerancia_pesos ?? 5),
    });
    return NextResponse.json(resultado);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo leer la foto.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }
}
