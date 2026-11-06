import { NextResponse } from "next/server";
import { descartarFoto, grabarFoto, guardarLectura } from "@/lib/facturaFoto";
import { supabaseServicio } from "@/lib/supabaseServidor";

export const runtime = "nodejs";

/**
 * Bot de Telegram, sin costo de licencia:
 * 1. En Telegram abra @BotFather, envíe /newbot y copie el token en TELEGRAM_BOT_TOKEN.
 * 2. En .env.local agregue GEMINI_API_KEY (Google AI Studio, cuota gratis) y SUPABASE_SERVICE_ROLE_KEY.
 * 3. Ejecute supabase/fotos-lectura.sql en el SQL Editor de Supabase.
 * 4. Con el sitio publicado, registre el webhook:
 *    https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SU-DOMINIO/api/telegram
 * El mismo grabado lo usa el celular en /fotos.
 */

async function responder(token: string, chat: number | string, texto: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto }),
  });
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !clave || !url) return NextResponse.json({ error: "Faltan el token del bot o la clave de servicio." }, { status: 503 });

  const cuerpo = await request.json().catch(() => null);
  const mensaje = cuerpo?.message;
  const chat = mensaje?.chat?.id as number | undefined;
  if (!chat) return NextResponse.json({ ok: true });

  const db = supabaseServicio();
  const texto = String(mensaje?.text ?? "").trim();

  if (/^si$/i.test(texto) || /^no$/i.test(texto)) {
    const pendiente = await db.from("fotos_factura")
      .select("id")
      .eq("origen", "telegram")
      .eq("estado", "borrador")
      .eq("telegram_chat", String(chat))
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pendiente.data) {
      await responder(token, chat, "No hay una factura pendiente de confirmar.");
      return NextResponse.json({ ok: true });
    }
    try {
      if (/^no$/i.test(texto)) {
        await descartarFoto(db, pendiente.data.id);
        await responder(token, chat, "Foto descartada. No se grabó la factura.");
      } else {
        const aviso = await grabarFoto(db, pendiente.data.id);
        await responder(token, chat, aviso);
      }
    } catch (error) {
      const aviso = error instanceof Error ? error.message : "No se pudo grabar.";
      await responder(token, chat, aviso);
    }
    return NextResponse.json({ ok: true });
  }

  const documento = mensaje?.document as { file_id?: string; mime_type?: string } | undefined;
  const fotoId = mensaje?.photo?.at(-1)?.file_id as string | undefined;
  const archivoId = fotoId || documento?.file_id;
  const mime = fotoId ? "image/jpeg" : (documento?.mime_type ?? "");
  const aceptado = Boolean(fotoId) || mime.startsWith("image/") || mime === "application/pdf";
  if (!archivoId || !aceptado) return NextResponse.json({ ok: true });

  try {
    const archivo = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${archivoId}`).then((respuesta) => respuesta.json());
    const rutaTelegram = archivo.result?.file_path as string | undefined;
    if (!rutaTelegram) {
      await responder(token, chat, "No pude descargar ese archivo. Envíe la foto de nuevo.");
      return NextResponse.json({ ok: true });
    }
    const binario = Buffer.from(await fetch(`https://api.telegram.org/file/bot${token}/${rutaTelegram}`).then((respuesta) => respuesta.arrayBuffer()));
    const empresa = await db.from("empresas").select("id, tolerancia_pesos").limit(1).maybeSingle();
    if (!empresa.data) {
      await responder(token, chat, "Todavía no hay una empresa en el sistema.");
      return NextResponse.json({ ok: true });
    }
    const extension = mime === "application/pdf" ? "pdf" : "jpg";
    const ruta = `${empresa.data.id}/${crypto.randomUUID()}.${extension}`;
    const subida = await db.storage.from("facturas-fotos").upload(ruta, binario, { contentType: mime || "image/jpeg" });
    if (subida.error) throw new Error(subida.error.message);
    const resultado = await guardarLectura(db, {
      empresaId: empresa.data.id,
      ruta,
      origen: "telegram",
      bytes: binario,
      mime: mime || "image/jpeg",
      telegramChat: String(chat),
      tolerancia: Number(empresa.data.tolerancia_pesos ?? 5),
    });
    await responder(token, chat, resultado.resumen);
  } catch (error) {
    const aviso = error instanceof Error ? error.message : "No se pudo leer la foto.";
    await responder(token, chat, aviso);
  }
  return NextResponse.json({ ok: true });
}
