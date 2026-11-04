import { NextResponse } from "next/server";
import { leerTextoFactura } from "@/lib/lectura";

export async function POST(request: Request) {
  const formulario = await request.formData();
  const archivo = formulario.get("foto");
  if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta la foto." }, { status: 400 });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa");
  const leido = await worker.recognize(Buffer.from(await archivo.arrayBuffer()));
  await worker.terminate();
  return NextResponse.json(leerTextoFactura(leido.data.text));
}
