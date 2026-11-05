import { fechaCorta } from "./fechas";
import { estadoVisible, formatoPeso } from "./formato";

type FilaReporte = { fecha: string; numero: string; saldo: number; estado: string; con_rapel?: boolean };

function redondear(valor: number) {
  return Math.round(valor);
}

async function generarHojaPendientes(
  filas: FilaReporte[],
  nombre: string,
  periodo: string,
  total: number,
): Promise<Blob | null> {
  const escala = 2;
  const anchoLogico = 760;
  const margen = 36;
  const altoTitulo = 52;
  const altoBarra = 40;
  const altoCabecera = 34;
  const altoFila = 30;
  const altoTotal = 42;
  const altoPie = 28;
  const paddingInferior = 28;
  const altoLogico =
    margen +
    altoTitulo +
    12 +
    altoBarra +
    10 +
    altoCabecera +
    filas.length * altoFila +
    4 +
    altoTotal +
    10 +
    altoPie +
    paddingInferior;

  const lienzo = document.createElement("canvas");
  lienzo.width = redondear(anchoLogico * escala);
  lienzo.height = redondear(Math.max(altoLogico, 280) * escala);
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;

  ctx.scale(escala, escala);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Fondo gris suave del "escenario"
  ctx.fillStyle = "#dfe3ef";
  ctx.fillRect(0, 0, anchoLogico, lienzo.height / escala);

  // Hoja blanca
  const hojaX = 18;
  const hojaY = 14;
  const hojaAncho = anchoLogico - 36;
  const hojaAlto = altoLogico - 28;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#d7dcf0";
  ctx.lineWidth = 1;
  ctx.fillRect(hojaX, hojaY, hojaAncho, hojaAlto);
  ctx.strokeRect(hojaX, hojaY, hojaAncho, hojaAlto);

  let y = hojaY + margen;

  // Título proveedor
  ctx.fillStyle = "#12141c";
  ctx.font = "800 28px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(nombre || "Proveedor", anchoLogico / 2, y + 28);
  y += altoTitulo;

  // Barra azul periodo
  const barraX = hojaX + 20;
  const barraAncho = hojaAncho - 40;
  ctx.fillStyle = "#2436f0";
  ctx.fillRect(barraX, y, barraAncho, altoBarra);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 14px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Facturas pendientes", barraX + 14, y + 26);
  ctx.font = "600 13px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`Periodo ${periodo}`, barraX + barraAncho - 14, y + 26);
  y += altoBarra + 10;

  // Cabecera tabla
  const colFecha = barraX + 14;
  const colFactura = barraX + 130;
  const colMonto = barraX + 320;
  const colEstado = barraX + 480;
  ctx.fillStyle = "#12141c";
  ctx.font = "750 13px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Fecha", colFecha, y + 22);
  ctx.fillText("Factura", colFactura, y + 22);
  ctx.fillText("Monto", colMonto, y + 22);
  ctx.fillText("Estado", colEstado, y + 22);
  y += altoCabecera;
  ctx.strokeStyle = "#d7dcf0";
  ctx.beginPath();
  ctx.moveTo(barraX, y - 4);
  ctx.lineTo(barraX + barraAncho, y - 4);
  ctx.stroke();

  // Filas
  filas.forEach((fila, indice) => {
    if (indice % 2 === 1) {
      ctx.fillStyle = "#f7f8fd";
      ctx.fillRect(barraX, y, barraAncho, altoFila);
    }
    ctx.fillStyle = "#12141c";
    ctx.font = "13px Segoe UI, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(fechaCorta(fila.fecha), colFecha, y + 20);
    ctx.fillText(String(fila.numero), colFactura, y + 20);
    ctx.fillText(formatoPeso(fila.saldo), colMonto, y + 20);
    ctx.fillText(estadoVisible(fila.estado, Boolean(fila.con_rapel)), colEstado, y + 20);
    ctx.strokeStyle = "#eef0f6";
    ctx.beginPath();
    ctx.moveTo(barraX, y + altoFila);
    ctx.lineTo(barraX + barraAncho, y + altoFila);
    ctx.stroke();
    y += altoFila;
  });

  y += 4;

  // Total
  ctx.fillStyle = "#2436f0";
  ctx.fillRect(barraX, y, barraAncho, altoTotal);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 14px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Total por pagar", barraX + 14, y + 27);
  ctx.font = "800 18px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(formatoPeso(total), barraX + barraAncho - 14, y + 27);
  y += altoTotal + 10;

  // Pie
  ctx.fillStyle = "#6b7289";
  ctx.font = "12px Segoe UI, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `${filas.length} factura${filas.length === 1 ? "" : "s"} pendiente${filas.length === 1 ? "" : "s"}`,
    barraX + 14,
    y + 14,
  );

  return await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/png"));
}

export async function copiarComoImagenPendientes(
  filas: FilaReporte[],
  nombre: string,
  periodo: string,
  total: number,
): Promise<boolean> {
  if (filas.length === 0) return false;
  const blob = await generarHojaPendientes(filas, nombre, periodo, total);
  if (!blob) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    // Si el portapapeles falla, descarga la imagen larga para pegarla después.
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `pendientes-${nombre || "proveedor"}.png`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
    return false;
  }
}

export async function copiarReportePendientes(
  filas: FilaReporte[],
  nombre: string,
  periodo: string,
  total: number,
) {
  const blob = await generarHojaPendientes(filas, nombre, periodo, total);
  if (!blob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch {
    // El navegador puede negar el portapapeles. La imagen igual se guarda.
  }
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = `pendientes-${nombre || "proveedor"}.png`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  window.open("https://web.whatsapp.com/", "_blank", "noopener");
}
