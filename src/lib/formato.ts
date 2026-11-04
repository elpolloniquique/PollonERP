import { redondearPeso } from "./dinero";

const pesos = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const detalle = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 4 });

export function formatoPeso(valor: number): string {
  const entero = redondearPeso(valor);
  const texto = pesos.format(Math.abs(entero));
  return `${entero < 0 ? "-" : ""}$ ${texto}`;
}

export function formatoEntero(valor: number): string {
  return pesos.format(redondearPeso(valor));
}

export function formatoDetalle(valor: number): string {
  return detalle.format(valor);
}

export function parseMonto(texto: string): number | null {
  const limpio = texto.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!limpio) return null;
  const normal = limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/\./g, "");
  const numero = Number(normal);
  return Number.isFinite(numero) ? numero : null;
}

export function estadoVisible(estado: string, conRapel = false): string {
  if (estado === "pagada" && conRapel) return "Pagado con Rapel";
  if (estado === "pago_parcial") return "Pago parcial";
  if (estado === "pagada") return "Pagada";
  if (estado === "anulada") return "Anulada";
  return "Pendiente";
}
