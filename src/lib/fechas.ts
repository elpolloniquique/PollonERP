export function sumarDias(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function fechasDeIngreso(ingreso: string, diasCredito: number) {
  return { emision: ingreso, vencimiento: sumarDias(ingreso, diasCredito) };
}

export function hoySantiago(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(ahora);
}

export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}-${mes}-${anio}`;
}

/** Vencida, dentro de 3 días, o dentro de 7. Más lejos no entra al aviso. */
export function semaforoVencimiento(vencimiento: string, hoy = hoySantiago()): "vencida" | "tres" | "siete" | null {
  const vence = vencimiento.slice(0, 10);
  if (vence < hoy) return "vencida";
  if (vence <= sumarDias(hoy, 3)) return "tres";
  if (vence <= sumarDias(hoy, 7)) return "siete";
  return null;
}
