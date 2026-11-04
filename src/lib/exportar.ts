import { fechaCorta } from "./fechas";
import { estadoVisible, formatoDetalle, formatoPeso } from "./formato";

export type FilaListado = {
  proveedor: string;
  fecha_ingreso: string;
  numero: string;
  neto_calculado: number;
  iva_calculado: number;
  total_oficial: number;
  saldo: number;
  estado: string;
  con_rapel?: boolean;
};

function hoja(nombre: string, usadas: Set<string>) {
  const base = (nombre || "Sin proveedor").replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Proveedor";
  let candidata = base;
  let n = 2;
  while (usadas.has(candidata)) {
    const sufijo = ` ${n}`;
    candidata = `${base.slice(0, 31 - sufijo.length)}${sufijo}`;
    n += 1;
  }
  usadas.add(candidata);
  return candidata;
}

export async function excelListado(filas: FilaListado[], periodo: string) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  const grupos = new Map<string, FilaListado[]>();
  for (const fila of filas) {
    const nombre = fila.proveedor || "Sin proveedor";
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), fila]);
  }
  const usadas = new Set<string>();
  for (const nombre of [...grupos.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
    const hojaLibro = libro.addWorksheet(hoja(nombre, usadas));
    hojaLibro.addRow([periodo]);
    hojaLibro.addRow(["Ingreso", "Número", "Neto", "IVA", "Total", "Saldo", "Estado"]);
    const delGrupo = grupos.get(nombre) ?? [];
    for (const fila of delGrupo) {
      hojaLibro.addRow([fechaCorta(fila.fecha_ingreso), fila.numero, Number(fila.neto_calculado), Number(fila.iva_calculado), Number(fila.total_oficial), Number(fila.saldo), estadoVisible(fila.estado, Boolean(fila.con_rapel))]);
    }
    const total = delGrupo.reduce((suma, fila) => suma + Number(fila.total_oficial), 0);
    const pendiente = delGrupo.reduce((suma, fila) => suma + Number(fila.saldo), 0);
    const pagado = delGrupo.reduce((suma, fila) => suma + (Number(fila.total_oficial) - Number(fila.saldo)), 0);
    hojaLibro.addRow([]);
    hojaLibro.addRow(["Cantidad de facturas", delGrupo.length]);
    hojaLibro.addRow(["Total", total]);
    hojaLibro.addRow(["Total pendiente", pendiente]);
    hojaLibro.addRow(["Total pagado", pagado]);
    hojaLibro.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
    hojaLibro.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2436F0" } };
  }
  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer]), `facturas-${periodo}.xlsx`);
}

export async function pdfListado(filas: FilaListado[], periodo: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const grupos = new Map<string, FilaListado[]>();
  for (const fila of filas) grupos.set(fila.proveedor || "Sin proveedor", [...(grupos.get(fila.proveedor || "Sin proveedor") ?? []), fila]);
  for (const nombre of [...grupos.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
    let pagina = pdf.addPage([595, 842]);
    let y = 800;
    const escribir = (texto: string, x = 40) => { pagina.drawText(texto.slice(0, 110), { x, y, size: 9, font: fuente, color: rgb(0.07, 0.08, 0.11) }); };
    escribir(`${nombre}  ${periodo}`, 40);
    y -= 18;
    for (const fila of grupos.get(nombre) ?? []) {
      if (y < 60) { pagina = pdf.addPage([595, 842]); y = 800; }
      escribir(`${fechaCorta(fila.fecha_ingreso)}  ${fila.numero}  ${formatoDetalle(Number(fila.neto_calculado))}  ${formatoDetalle(Number(fila.iva_calculado))}  ${formatoPeso(Number(fila.total_oficial))}  ${formatoPeso(Number(fila.saldo))}  ${estadoVisible(fila.estado, Boolean(fila.con_rapel))}`);
      y -= 14;
    }
  }
  descargar(new Blob([await pdf.save()]), `facturas-${periodo}.pdf`);
}

export async function pdfLiquidacion(titulo: string, lineas: string[]) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage([595, 842]);
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const linea of [titulo, ...lineas]) {
    pagina.drawText(linea.slice(0, 90), { x: 40, y, size: 11, font: fuente });
    y -= 16;
  }
  descargar(new Blob([await pdf.save()]), "liquidacion.pdf");
}

function descargar(blob: Blob, nombre: string) {
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  enlace.click();
}
