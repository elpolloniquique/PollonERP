import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { leerTextoFactura } from "@/lib/lectura";
import { fechasDeIngreso } from "@/lib/fechas";

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !clave || !url) return NextResponse.json({ error: "Faltan el token del bot o la clave de servicio en el servidor." }, { status: 503 });
  const cuerpo = await request.json();
  const mensaje = cuerpo.message;
  const chat = mensaje?.chat?.id;
  const responder = (texto: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto }),
  });
  const supabase = createClient(url, clave);
  const texto = String(mensaje?.text ?? "");
  if (/^si$/i.test(texto.trim())) {
    const pendiente = await supabase.from("fotos_factura").select("*").eq("estado", "borrador").order("creado_en", { ascending: false }).limit(1).maybeSingle();
    const foto = pendiente.data;
    if (!foto?.cierra) {
      await responder("La lectura no cierra neto, IVA y total. No se guardó.");
      return NextResponse.json({ ok: true });
    }
    if (!foto.proveedor_id) {
      await supabase.from("fotos_factura").update({ estado: "sin_proveedor" }).eq("id", foto.id);
      await responder("El proveedor no existe. La foto quedó en la bandeja para asignarlo.");
      return NextResponse.json({ ok: true });
    }
    const proveedor = await supabase.from("proveedores").select("dias_credito, porcentaje_iva").eq("id", foto.proveedor_id).single();
    const ingreso = foto.fecha || new Date().toISOString().slice(0, 10);
    const fechas = fechasDeIngreso(ingreso, Number(proveedor.data?.dias_credito ?? 0));
    const creada = await supabase.from("facturas").insert({
      empresa_id: foto.empresa_id,
      proveedor_id: foto.proveedor_id,
      numero: foto.numero || `TG-${Date.now()}`,
      fecha_ingreso: ingreso,
      fecha_emision: fechas.emision,
      fecha_vencimiento: fechas.vencimiento,
      porcentaje_iva: proveedor.data?.porcentaje_iva ?? 19,
      neto_calculado: foto.neto,
      iva_calculado: foto.iva,
      total_calculado: Number(foto.neto) + Number(foto.iva),
      total_oficial: foto.total,
      ajuste_redondeo: Number(foto.total) - (Number(foto.neto) + Number(foto.iva)),
      origen: "telegram",
    }).select("id").single();
    if (creada.data) {
      await supabase.from("factura_lineas").insert({
        factura_id: creada.data.id, orden: 0, codigo: "", descripcion: "Según lectura", unidad: "Unidad",
        cantidad: 1, precio_neto_unitario: foto.neto, descuento_porcentaje: 0, aplica_iva: Number(foto.iva) > 0,
        base: foto.neto, neto_linea: foto.neto, iva_linea: foto.iva, total_linea: Number(foto.neto) + Number(foto.iva),
      });
      await supabase.from("fotos_factura").update({ estado: "confirmada" }).eq("id", foto.id);
      await responder("Factura creada. Revísela en el sistema.");
    }
    return NextResponse.json({ ok: true });
  }

  const fotoId = mensaje?.photo?.at(-1)?.file_id;
  if (!fotoId || !chat) return NextResponse.json({ ok: true });
  const archivo = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fotoId}`).then((respuesta) => respuesta.json());
  const rutaTelegram = archivo.result?.file_path as string | undefined;
  if (!rutaTelegram) return NextResponse.json({ ok: true });
  const binario = await fetch(`https://api.telegram.org/file/bot${token}/${rutaTelegram}`).then((respuesta) => respuesta.arrayBuffer());
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa");
  const leido = await worker.recognize(Buffer.from(binario));
  await worker.terminate();
  const lectura = leerTextoFactura(leido.data.text);
  const empresa = await supabase.from("empresas").select("id").limit(1).maybeSingle();
  const ruta = `${empresa.data?.id ?? "telegram"}/${crypto.randomUUID()}.jpg`;
  await supabase.storage.from("facturas-fotos").upload(ruta, Buffer.from(binario), { contentType: "image/jpeg" });
  let proveedorId: string | null = null;
  if (lectura.rut) {
    const limpio = lectura.rut.replace(/\./g, "");
    const proveedor = await supabase.from("proveedores").select("id").eq("rut", limpio).maybeSingle();
    proveedorId = proveedor.data?.id ?? null;
  }
  if (empresa.data) {
    await supabase.from("fotos_factura").insert({
      empresa_id: empresa.data.id, ruta, origen: "telegram", estado: proveedorId ? "borrador" : "sin_proveedor",
      proveedor_id: proveedorId, rut_leido: lectura.rut, numero: lectura.numero, fecha: lectura.fecha || null,
      neto: lectura.neto, iva: lectura.iva, total: lectura.total, cierra: lectura.cierra, resumen: lectura.resumen,
    });
  }
  await responder(`${lectura.resumen}\n\nResponda SI para crear la factura si el proveedor existe y la lectura cierra.`);
  return NextResponse.json({ ok: true });
}
