import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularFactura } from "@/lib/dinero";
import { fechaCorta, hoySantiago, sumarDias } from "@/lib/fechas";
import { formatoPeso } from "@/lib/formato";
import { normalizarRut } from "@/lib/rut";

export type LineaLeida = { descripcion: string; cantidad: number; precio_neto_unitario: number };

export type LecturaGemini = {
  proveedor: string;
  rut: string;
  numero: string;
  fecha_emision: string;
  neto: number;
  iva: number;
  total: number;
  lineas: LineaLeida[];
};

export type FotoFactura = {
  id: string;
  empresa_id: string;
  ruta: string;
  origen: "telegram" | "camara";
  estado: string;
  proveedor_id: string | null;
  rut_leido: string;
  numero: string;
  fecha: string | null;
  neto: number;
  iva: number;
  total: number;
  cierra: boolean;
  resumen: string;
  telegram_chat?: string;
};

type ProveedorFila = { id: string; nombre: string; rut: string; dias_credito?: number; porcentaje_iva?: number };

const INSTRUCCION = `Lee una factura chilena (foto o PDF) y responde solo JSON, sin markdown.
{
  "proveedor": "razon social o nombre",
  "rut": "cuerpo-dv",
  "numero": "folio sin puntos",
  "fecha_emision": "YYYY-MM-DD",
  "neto": 0,
  "iva": 0,
  "total": 0,
  "lineas": [{ "descripcion": "", "cantidad": 0, "precio_neto_unitario": 0 }]
}
Montos en pesos enteros. neto es el monto neto, iva el impuesto y total el total a pagar.
Si un dato no se lee, usa texto vacío o 0. No inventes un proveedor ni un folio.`;

export async function leerConGemini(bytes: Buffer, mime: string): Promise<LecturaGemini> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new Error("Falta GEMINI_API_KEY en el servidor.");
  const modelo = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${clave}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: INSTRUCCION },
            { inline_data: { mime_type: mime || "image/jpeg", data: bytes.toString("base64") } },
          ],
        }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) {
    const detalle = cuerpo?.error?.message ?? "Gemini no respondió.";
    throw new Error(detalle);
  }
  const texto = (cuerpo.candidates?.[0]?.content?.parts ?? []).map((parte: { text?: string }) => parte.text ?? "").join("");
  return normalizarLectura(texto);
}

function numero(valor: unknown): number {
  if (typeof valor === "number" && Number.isFinite(valor)) return Math.round(valor);
  const limpio = String(valor ?? "").replace(/[^\d-]/g, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function normalizarLectura(texto: string): LecturaGemini {
  const limpio = texto.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  const crudo = JSON.parse(limpio) as Partial<LecturaGemini>;
  const lineas = Array.isArray(crudo.lineas) ? crudo.lineas : [];
  return {
    proveedor: String(crudo.proveedor ?? "").trim(),
    rut: String(crudo.rut ?? "").trim(),
    numero: String(crudo.numero ?? "").replace(/\D/g, ""),
    fecha_emision: /^\d{4}-\d{2}-\d{2}/.test(String(crudo.fecha_emision ?? "")) ? String(crudo.fecha_emision).slice(0, 10) : "",
    neto: numero(crudo.neto),
    iva: numero(crudo.iva),
    total: numero(crudo.total),
    lineas: lineas.map((linea) => ({
      descripcion: String(linea.descripcion ?? "").trim(),
      cantidad: Number(linea.cantidad) || 0,
      precio_neto_unitario: numero(linea.precio_neto_unitario),
    })).filter((linea) => linea.descripcion && linea.cantidad > 0 && linea.precio_neto_unitario > 0),
  };
}

function nombreClave(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rutClave(valor: string) {
  const normal = normalizarRut(valor);
  if ("guardado" in normal) return normal.guardado.replace(/\./g, "").toLowerCase();
  return valor.replace(/[^0-9kK]/g, "").toLowerCase();
}

export function emparejarProveedor(lista: ProveedorFila[], lectura: LecturaGemini): ProveedorFila | null {
  const rut = rutClave(lectura.rut);
  if (rut.length >= 2) {
    const porRut = lista.find((item) => rutClave(item.rut) === rut);
    if (porRut) return porRut;
  }
  const nombre = nombreClave(lectura.proveedor);
  if (nombre.length < 4) return null;
  const exactos = lista.filter((item) => nombreClave(item.nombre) === nombre);
  if (exactos.length === 1) return exactos[0];
  const contenidos = lista.filter((item) => {
    const clave = nombreClave(item.nombre);
    return clave.length >= 4 && (clave.includes(nombre) || nombre.includes(clave));
  });
  return contenidos.length === 1 ? contenidos[0] : null;
}

export function textoLectura(opciones: {
  proveedor: string;
  numero: string;
  fecha: string;
  total: number;
  puede: boolean;
  motivo: string;
}) {
  const lineas = [
    `Proveedor: ${opciones.proveedor || "no identificado"}`,
    `Factura: ${opciones.numero || "no leída"}`,
    `Fecha: ${opciones.fecha ? fechaCorta(opciones.fecha) : "no leída"}`,
    `Total: ${formatoPeso(opciones.total)}`,
  ];
  lineas.push(opciones.puede
    ? "¿El total está bien? Responda SI para grabar o NO para descartar."
    : opciones.motivo);
  return lineas.join("\n");
}

export async function guardarLectura(db: SupabaseClient, entrada: {
  empresaId: string;
  ruta: string;
  origen: "telegram" | "camara";
  bytes: Buffer;
  mime: string;
  telegramChat?: string;
  tolerancia: number;
}) {
  const lectura = await leerConGemini(entrada.bytes, entrada.mime);
  const proveedores = await db.from("proveedores").select("id, nombre, rut, dias_credito, porcentaje_iva").eq("empresa_id", entrada.empresaId).eq("activo", true);
  const lista = (proveedores.data ?? []) as ProveedorFila[];
  const proveedor = emparejarProveedor(lista, lectura);
  const diferencia = Math.abs(lectura.neto + lectura.iva - lectura.total);
  const cierra = lectura.neto > 0 && lectura.total > 0 && diferencia <= Math.max(entrada.tolerancia, 0);
  let duplicada = false;
  if (proveedor && lectura.numero) {
    const ya = await db.from("facturas").select("id").eq("proveedor_id", proveedor.id).eq("numero", lectura.numero).maybeSingle();
    duplicada = Boolean(ya.data);
  }
  let motivo = "La foto no se leyó bien. Envíe otra más nítida, con el total visible.";
  if (!proveedor) motivo = "No encontré ese proveedor en el sistema. La foto quedó en borrador.";
  else if (!lectura.numero) motivo = "No leí el número de factura. Envíe otra foto más nítida.";
  else if (!cierra) motivo = "El neto, el IVA y el total no cierran. Envíe otra foto más nítida.";
  else if (duplicada) motivo = "Esa factura ya está registrada. No se duplicó.";
  const puede = Boolean(proveedor && lectura.numero && cierra && !duplicada);
  const resumen = textoLectura({
    proveedor: proveedor?.nombre || lectura.proveedor,
    numero: lectura.numero,
    fecha: lectura.fecha_emision,
    total: lectura.total,
    puede,
    motivo,
  });
  const fila = {
    empresa_id: entrada.empresaId,
    ruta: entrada.ruta,
    origen: entrada.origen,
    estado: "borrador",
    proveedor_id: proveedor?.id ?? null,
    rut_leido: lectura.rut,
    numero: lectura.numero,
    fecha: lectura.fecha_emision || null,
    neto: lectura.neto,
    iva: lectura.iva,
    total: lectura.total,
    cierra,
    resumen,
    telegram_chat: entrada.telegramChat ?? "",
  };
  const insertada = await db.from("fotos_factura").insert(fila).select("*").single();
  if (insertada.error) throw new Error(insertada.error.message);
  return { foto: insertada.data as FotoFactura, resumen, puede };
}

export async function descartarFoto(db: SupabaseClient, fotoId: string) {
  const actualizada = await db.from("fotos_factura").update({ estado: "descartada" }).eq("id", fotoId);
  if (actualizada.error) throw new Error(actualizada.error.message);
}

export async function grabarFoto(db: SupabaseClient, fotoId: string): Promise<string> {
  const consulta = await db.from("fotos_factura").select("*").eq("id", fotoId).single();
  const foto = consulta.data as FotoFactura | null;
  if (!foto) throw new Error("No encontré esa foto.");
  if (foto.estado === "confirmada") throw new Error("Esa factura ya fue grabada.");
  if (foto.estado === "descartada") throw new Error("Esa foto fue descartada.");
  if (!foto.proveedor_id) throw new Error("No encontré ese proveedor en el sistema. No se grabó.");
  if (!foto.numero) throw new Error("No leí el número de factura. No se grabó.");
  if (!foto.cierra) throw new Error("El neto, el IVA y el total no cierran. No se grabó.");

  const ya = await db.from("facturas").select("id").eq("proveedor_id", foto.proveedor_id).eq("numero", foto.numero).maybeSingle();
  if (ya.data) throw new Error("Esa factura ya está registrada. No se duplicó.");

  const proveedor = await db.from("proveedores").select("dias_credito, porcentaje_iva").eq("id", foto.proveedor_id).single();
  const empresa = await db.from("empresas").select("tolerancia_pesos").eq("id", foto.empresa_id).single();
  const porcentaje = Number(proveedor.data?.porcentaje_iva ?? 19);
  const tolerancia = Number(empresa.data?.tolerancia_pesos ?? 5);
  const emision = foto.fecha || hoySantiago();
  const ingreso = hoySantiago();
  const vencimiento = sumarDias(emision, Number(proveedor.data?.dias_credito ?? 0));
  const calculo = calcularFactura(
    [{ cantidad: 1, precioNetoUnitario: Number(foto.neto), descuentoPorcentaje: 0, aplicaIva: true }],
    porcentaje,
    Number(foto.total),
    tolerancia,
  );
  const linea = calculo.lineas[0];
  const creada = await db.from("facturas").insert({
    empresa_id: foto.empresa_id,
    proveedor_id: foto.proveedor_id,
    numero: foto.numero,
    fecha_ingreso: ingreso,
    fecha_emision: emision,
    fecha_vencimiento: vencimiento,
    porcentaje_iva: porcentaje,
    neto_calculado: calculo.netoCalculado,
    iva_calculado: calculo.ivaCalculado,
    total_calculado: calculo.totalCalculado,
    total_oficial: calculo.totalOficial,
    ajuste_redondeo: calculo.ajusteRedondeo,
    origen: foto.origen,
    observaciones: "Leída desde foto",
  }).select("id").single();
  if (creada.error || !creada.data) throw new Error(creada.error?.message ?? "No se pudo grabar la factura.");

  const guardada = await db.from("factura_lineas").insert({
    factura_id: creada.data.id,
    orden: 0,
    codigo: "",
    descripcion: "Según documento",
    unidad: "Unidad",
    cantidad: linea.cantidad,
    precio_neto_unitario: linea.precioNetoUnitario,
    descuento_porcentaje: 0,
    aplica_iva: true,
    base: linea.base,
    neto_linea: linea.netoLinea,
    iva_linea: linea.ivaLinea,
    total_linea: linea.totalLinea,
  });
  if (guardada.error) {
    await db.from("facturas").delete().eq("id", creada.data.id);
    throw new Error(guardada.error.message);
  }
  const marcada = await db.from("fotos_factura").update({ estado: "confirmada" }).eq("id", foto.id);
  if (marcada.error) throw new Error(marcada.error.message);
  return `Factura ${foto.numero} grabada. Total ${formatoPeso(Number(foto.total))}.`;
}
