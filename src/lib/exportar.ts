import { fechaCorta } from "./fechas";
import { estadoVisible, formatoPeso } from "./formato";

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

function nombreTabla(indice: number) {
  return `FacturasProv${indice}`;
}

/** Formato de pesos para Excel (evita comillas anidadas que rompen el parser). */
const FORMATO_PESO_EXCEL = "$#,##0;($#,##0);-";

export async function excelListado(filas: FilaListado[], periodo: string) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "SG Proveedores";
  libro.created = new Date();

  const grupos = new Map<string, FilaListado[]>();
  for (const fila of filas) {
    const nombre = fila.proveedor || "Sin proveedor";
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), fila]);
  }

  const usadas = new Set<string>();
  let indiceHoja = 0;
  for (const nombre of [...grupos.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
    indiceHoja += 1;
    const delGrupo = [...(grupos.get(nombre) ?? [])].sort((a, b) =>
      a.fecha_ingreso === b.fecha_ingreso ? a.numero.localeCompare(b.numero, "es") : a.fecha_ingreso.localeCompare(b.fecha_ingreso),
    );
    const hojaLibro = libro.addWorksheet(hoja(nombre, usadas), {
      views: [{ state: "frozen", ySplit: 4 }],
      properties: { defaultRowHeight: 18 },
    });

    hojaLibro.mergeCells("A1:G1");
    const titulo = hojaLibro.getCell("A1");
    titulo.value = nombre;
    titulo.font = { bold: true, size: 16, color: { argb: "FF12141C" } };
    titulo.alignment = { vertical: "middle" };
    hojaLibro.getRow(1).height = 28;

    hojaLibro.mergeCells("A2:G2");
    const subtitulo = hojaLibro.getCell("A2");
    subtitulo.value = `Facturas · Periodo ${periodo}`;
    subtitulo.font = { size: 11, color: { argb: "FF5C6478" } };

    hojaLibro.getRow(3).height = 8;

    const inicioTabla = 4;
    const filasDatos = delGrupo.map((fila) => [
      fechaCorta(fila.fecha_ingreso),
      fila.numero,
      Number(fila.neto_calculado),
      Number(fila.iva_calculado),
      Number(fila.total_oficial),
      Number(fila.saldo),
      estadoVisible(fila.estado, Boolean(fila.con_rapel)),
    ]);

    if (filasDatos.length === 0) {
      hojaLibro.getCell("A4").value = "Sin facturas en este periodo.";
    } else {
      hojaLibro.addTable({
        name: nombreTabla(indiceHoja),
        ref: `A${inicioTabla}`,
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium2",
          showRowStripes: true,
        },
        columns: [
          { name: "Fecha ingreso", filterButton: true },
          { name: "Número", filterButton: true },
          { name: "Neto", filterButton: true },
          { name: "IVA", filterButton: true },
          { name: "Total", filterButton: true },
          { name: "Saldo pendiente", filterButton: true },
          { name: "Estado", filterButton: true },
        ],
        rows: filasDatos,
      });

      const ultimaDato = inicioTabla + filasDatos.length;
      for (let fila = inicioTabla + 1; fila <= ultimaDato; fila += 1) {
        for (const col of [3, 4, 5, 6]) {
          hojaLibro.getCell(fila, col).numFmt = FORMATO_PESO_EXCEL;
          hojaLibro.getCell(fila, col).alignment = { horizontal: "right" };
        }
      }
      hojaLibro.getRow(inicioTabla).font = { bold: true, color: { argb: "FFFFFFFF" } };
      hojaLibro.getRow(inicioTabla).alignment = { vertical: "middle" };
      hojaLibro.getRow(inicioTabla).height = 22;

      const total = delGrupo.reduce((suma, fila) => suma + Number(fila.total_oficial), 0);
      const pendiente = delGrupo.reduce((suma, fila) => suma + Number(fila.saldo), 0);
      const pagado = delGrupo.reduce((suma, fila) => suma + Math.max(Number(fila.total_oficial) - Number(fila.saldo), 0), 0);
      const baseResumen = ultimaDato + 2;

      hojaLibro.getCell(`A${baseResumen}`).value = "Resumen";
      hojaLibro.getCell(`A${baseResumen}`).font = { bold: true, size: 12, color: { argb: "FF2436F0" } };

      const bloques = [
        ["Cantidad de facturas", delGrupo.length, false],
        ["Total pendiente", pendiente, true],
        ["Total pagado", pagado, true],
        ["Total general", total, true],
      ] as const;

      bloques.forEach(([etiqueta, valor, dinero], i) => {
        const fila = baseResumen + 1 + i;
        hojaLibro.getCell(`A${fila}`).value = etiqueta;
        hojaLibro.getCell(`A${fila}`).font = { bold: true, color: { argb: "FF5C6478" } };
        hojaLibro.getCell(`B${fila}`).value = valor;
        hojaLibro.getCell(`B${fila}`).font = { bold: true, color: { argb: "FF12141C" } };
        if (dinero) hojaLibro.getCell(`B${fila}`).numFmt = FORMATO_PESO_EXCEL;
        if (etiqueta === "Total pendiente") hojaLibro.getCell(`B${fila}`).font = { bold: true, color: { argb: "FFC5364A" } };
        if (etiqueta === "Total pagado") hojaLibro.getCell(`B${fila}`).font = { bold: true, color: { argb: "FF0F7A4A" } };
        if (etiqueta === "Total general") {
          hojaLibro.getCell(`A${fila}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECEFFE" } };
          hojaLibro.getCell(`B${fila}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECEFFE" } };
        }
      });
    }

    hojaLibro.columns = [
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
    ];
  }

  if (grupos.size === 0) {
    const vacia = libro.addWorksheet("Facturas");
    vacia.getCell("A1").value = "No hay facturas para exportar.";
  }

  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer as BlobPart]), `facturas-${periodo.replace(/\s+/g, "-")}.xlsx`);
}

export async function pdfListado(filas: FilaListado[], periodo: string) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.07, 0.08, 0.11);
  const acento = rgb(0.14, 0.21, 0.94);
  const gris = rgb(0.36, 0.39, 0.47);

  const grupos = new Map<string, FilaListado[]>();
  for (const fila of filas) {
    const nombre = fila.proveedor || "Sin proveedor";
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), fila]);
  }

  const nombres = [...grupos.keys()].sort((a, b) => a.localeCompare(b, "es"));
  if (nombres.length === 0) {
    const pagina = pdf.addPage([595, 842]);
    pagina.drawText("No hay facturas para exportar.", { x: 40, y: 800, size: 12, font: fuente, color: tinta });
  }

  for (const nombre of nombres) {
    const delGrupo = [...(grupos.get(nombre) ?? [])].sort((a, b) =>
      a.fecha_ingreso === b.fecha_ingreso ? a.numero.localeCompare(b.numero, "es") : a.fecha_ingreso.localeCompare(b.fecha_ingreso),
    );
    let pagina = pdf.addPage([595, 842]);
    let y = 800;

    const encabezado = () => {
      pagina.drawText(nombre.slice(0, 60), { x: 40, y, size: 14, font: negrita, color: acento });
      y -= 16;
      pagina.drawText(`Periodo ${periodo}`, { x: 40, y, size: 10, font: fuente, color: gris });
      y -= 18;
      pagina.drawText("Fecha", { x: 40, y, size: 9, font: negrita, color: tinta });
      pagina.drawText("Número", { x: 100, y, size: 9, font: negrita, color: tinta });
      pagina.drawText("Total", { x: 200, y, size: 9, font: negrita, color: tinta });
      pagina.drawText("Saldo", { x: 290, y, size: 9, font: negrita, color: tinta });
      pagina.drawText("Estado", { x: 380, y, size: 9, font: negrita, color: tinta });
      y -= 12;
      pagina.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.89, 0.9, 0.95) });
      y -= 14;
    };

    encabezado();
    for (const fila of delGrupo) {
      if (y < 90) {
        pagina = pdf.addPage([595, 842]);
        y = 800;
        encabezado();
      }
      pagina.drawText(fechaCorta(fila.fecha_ingreso), { x: 40, y, size: 9, font: fuente, color: tinta });
      pagina.drawText(String(fila.numero).slice(0, 18), { x: 100, y, size: 9, font: fuente, color: tinta });
      pagina.drawText(formatoPeso(Number(fila.total_oficial)), { x: 200, y, size: 9, font: fuente, color: tinta });
      pagina.drawText(formatoPeso(Number(fila.saldo)), { x: 290, y, size: 9, font: fuente, color: tinta });
      pagina.drawText(estadoVisible(fila.estado, Boolean(fila.con_rapel)).slice(0, 18), { x: 380, y, size: 9, font: fuente, color: tinta });
      y -= 14;
    }

    const total = delGrupo.reduce((suma, fila) => suma + Number(fila.total_oficial), 0);
    const pendiente = delGrupo.reduce((suma, fila) => suma + Number(fila.saldo), 0);
    const pagado = delGrupo.reduce((suma, fila) => suma + Math.max(Number(fila.total_oficial) - Number(fila.saldo), 0), 0);
    if (y < 100) {
      pagina = pdf.addPage([595, 842]);
      y = 800;
    }
    y -= 10;
    pagina.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.89, 0.9, 0.95) });
    y -= 18;
    pagina.drawText(`Facturas: ${delGrupo.length}`, { x: 40, y, size: 10, font: fuente, color: gris });
    y -= 14;
    pagina.drawText(`Total pendiente: ${formatoPeso(pendiente)}`, { x: 40, y, size: 11, font: negrita, color: rgb(0.77, 0.21, 0.29) });
    y -= 14;
    pagina.drawText(`Total pagado: ${formatoPeso(pagado)}`, { x: 40, y, size: 11, font: negrita, color: rgb(0.06, 0.48, 0.29) });
    y -= 14;
    pagina.drawText(`Total general: ${formatoPeso(total)}`, { x: 40, y, size: 12, font: negrita, color: acento });
  }

  descargar(new Blob([await pdf.save()]), `facturas-${periodo.replace(/\s+/g, "-")}.pdf`);
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

export type FilaPendientePdf = {
  fecha: string;
  numero: string;
  saldo: number;
  estado: string;
  con_rapel?: boolean;
};

export type GrupoPendientePdf = {
  proveedor: string;
  periodo: string;
  filas: FilaPendientePdf[];
};

/** PDF de pendientes de todos los proveedores. Devuelve URL para embeber. */
export async function pdfPendientesTodos(grupos: GrupoPendientePdf[]): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const tinta = rgb(0.07, 0.08, 0.11);
  const acento = rgb(0.14, 0.21, 0.94);
  const gris = rgb(0.36, 0.39, 0.47);
  const blanco = rgb(1, 1, 1);
  const linea = rgb(0.89, 0.9, 0.95);

  let pagina = pdf.addPage([595, 842]);
  let y = 800;
  const totalGeneral = grupos.reduce(
    (suma, grupo) => suma + grupo.filas.reduce((s, fila) => s + Number(fila.saldo), 0),
    0,
  );

  const nuevaPagina = () => {
    pagina = pdf.addPage([595, 842]);
    y = 800;
  };

  const dibujarCabeceraGeneral = () => {
    pagina.drawRectangle({ x: 40, y: y - 8, width: 515, height: 28, color: acento });
    pagina.drawText("Facturas pendientes · Todos los proveedores", { x: 52, y, size: 12, font: negrita, color: blanco });
    y -= 28;
    pagina.drawText(`Total general ${formatoPeso(totalGeneral)}`, { x: 40, y, size: 10, font: fuente, color: gris });
    y -= 18;
  };

  dibujarCabeceraGeneral();

  if (grupos.length === 0) {
    pagina.drawText("Sin facturas pendientes.", { x: 40, y, size: 11, font: fuente, color: gris });
  }

  for (const grupo of grupos) {
    const totalGrupo = grupo.filas.reduce((suma, fila) => suma + Number(fila.saldo), 0);
    if (y < 160) nuevaPagina();

    pagina.drawText((grupo.proveedor || "Proveedor").slice(0, 50), { x: 40, y, size: 12, font: negrita, color: acento });
    y -= 14;
    pagina.drawText(grupo.periodo, { x: 40, y, size: 9, font: fuente, color: gris });
    y -= 16;
    pagina.drawText("Fecha", { x: 40, y, size: 9, font: negrita, color: tinta });
    pagina.drawText("Factura", { x: 120, y, size: 9, font: negrita, color: tinta });
    pagina.drawText("Monto", { x: 280, y, size: 9, font: negrita, color: tinta });
    pagina.drawText("Estado", { x: 400, y, size: 9, font: negrita, color: tinta });
    y -= 8;
    pagina.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: linea });
    y -= 14;

    for (const fila of grupo.filas) {
      if (y < 80) {
        nuevaPagina();
        pagina.drawText(`${(grupo.proveedor || "Proveedor").slice(0, 40)} (continuación)`, {
          x: 40, y, size: 10, font: negrita, color: acento,
        });
        y -= 18;
      }
      pagina.drawText(fechaCorta(fila.fecha), { x: 40, y, size: 9, font: fuente, color: tinta });
      pagina.drawText(String(fila.numero).slice(0, 22), { x: 120, y, size: 9, font: fuente, color: tinta });
      pagina.drawText(formatoPeso(Number(fila.saldo)), { x: 280, y, size: 9, font: fuente, color: tinta });
      pagina.drawText(estadoVisible(fila.estado, Boolean(fila.con_rapel)).slice(0, 18), {
        x: 400, y, size: 9, font: fuente, color: tinta,
      });
      y -= 13;
    }

    if (y < 70) nuevaPagina();
    y -= 4;
    pagina.drawText(`Subtotal ${grupo.proveedor.slice(0, 30)}: ${formatoPeso(totalGrupo)}`, {
      x: 40, y, size: 10, font: negrita, color: tinta,
    });
    y -= 22;
  }

  if (y < 70) nuevaPagina();
  pagina.drawRectangle({ x: 40, y: y - 10, width: 515, height: 32, color: acento });
  pagina.drawText("Total por pagar (todos)", { x: 52, y, size: 11, font: negrita, color: blanco });
  pagina.drawText(formatoPeso(totalGeneral), { x: 390, y, size: 12, font: negrita, color: blanco });

  const bytes = await pdf.save();
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

function descargar(blob: Blob, nombre: string) {
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  enlace.click();
}
