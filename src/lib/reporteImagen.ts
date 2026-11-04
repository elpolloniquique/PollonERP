import { fechaCorta } from "./fechas";
import { estadoVisible, formatoPeso } from "./formato";

export async function copiarReportePendientes(filas: { fecha: string; numero: string; saldo: number; estado: string }[], nombre: string, periodo: string, total: number) {
  const ancho = 720;
  const altoFila = 28;
  const alto = 48 + filas.length * altoFila + 40 + 130;
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = Math.max(alto, 220);
  const ctx = lienzo.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#F4F6FB";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = "#2436F0";
  ctx.fillRect(24, 16, ancho - 48, 32);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 13px Segoe UI";
  ctx.fillText("Fecha", 36, 37);
  ctx.fillText("Factura", 160, 37);
  ctx.fillText("Monto", 360, 37);
  ctx.fillText("Estado", 520, 37);
  filas.forEach((fila, indice) => {
    const y = 48 + indice * altoFila;
    ctx.fillStyle = indice % 2 === 0 ? "#FFFFFF" : "#E4F2FB";
    ctx.fillRect(24, y, ancho - 48, altoFila);
    ctx.fillStyle = "#12141C";
    ctx.font = "13px Segoe UI";
    ctx.fillText(fechaCorta(fila.fecha), 36, y + 18);
    ctx.fillText(fila.numero, 160, y + 18);
    ctx.fillText(formatoPeso(fila.saldo), 360, y + 18);
    ctx.fillText(estadoVisible(fila.estado), 520, y + 18);
  });
  const pie = 48 + filas.length * altoFila;
  ctx.fillStyle = "#2436F0";
  ctx.fillRect(24, pie, ancho - 48, 32);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 13px Segoe UI";
  ctx.fillText("Total por pagar", 36, pie + 21);
  ctx.fillText(formatoPeso(total), 520, pie + 21);
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#E3E6F2";
  ctx.fillRect(196, pie + 48, 328, 96);
  ctx.strokeRect(196, pie + 48, 328, 96);
  ctx.fillStyle = "#12141C";
  ctx.font = "600 16px Segoe UI";
  ctx.fillText(nombre, 214, pie + 78);
  ctx.font = "13px Segoe UI";
  ctx.fillText(periodo, 214, pie + 100);
  ctx.fillStyle = "#2436F0";
  ctx.font = "700 18px Segoe UI";
  ctx.fillText(formatoPeso(total), 214, pie + 126);

  const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/png"));
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
  window.open("https://web.whatsapp.com/", "_blank", "noopener");
}
