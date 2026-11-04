export type LecturaFactura = {
  rut: string;
  numero: string;
  fecha: string;
  neto: number;
  iva: number;
  total: number;
  cierra: boolean;
  resumen: string;
};

export function leerTextoFactura(texto: string): LecturaFactura {
  const rut = texto.match(/\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]/)?.[0] ?? "";
  const numero = texto.match(/(?:N[°ºo]|folio|factura)\s*[:.]?\s*(\d{3,})/i)?.[1] ?? "";
  const fechaCruda = texto.match(/(\d{2})[/-](\d{2})[/-](\d{4})/) ?? texto.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  const fecha = !fechaCruda ? "" : fechaCruda[1].length === 4 ? `${fechaCruda[1]}-${fechaCruda[2]}-${fechaCruda[3]}` : `${fechaCruda[3]}-${fechaCruda[2]}-${fechaCruda[1]}`;
  const monto = (etiqueta: string) => {
    const hallado = texto.match(new RegExp(`${etiqueta}[^\\d]{0,12}([\\d.]{3,})`, "i"));
    return hallado ? Number(hallado[1].replace(/\./g, "")) : 0;
  };
  const neto = monto("neto");
  const iva = monto("iva");
  const total = monto("total");
  const cierra = neto > 0 && total > 0 && Math.abs(neto + iva - total) <= 5;
  const resumen = [`RUT ${rut || "no leído"}`, `N° ${numero || "no leído"}`, `Fecha ${fecha || "no leída"}`, `Neto ${neto}`, `IVA ${iva}`, `Total ${total}`, cierra ? "La lectura cierra." : "La lectura no cierra neto, IVA y total."].join("\n");
  return { rut, numero, fecha, neto, iva, total, cierra, resumen };
}
