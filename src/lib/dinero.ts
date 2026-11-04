/** Redondeo alejándose de cero, igual que MidpointRounding.AwayFromZero. */
export function redondear(valor: number, decimales: number): number {
  if (!Number.isFinite(valor)) return 0;
  const factor = 10 ** decimales;
  const escalado = valor * factor;
  const signo = escalado < 0 ? -1 : 1;
  return (signo * Math.round(Math.abs(escalado))) / factor;
}

export function redondear4(valor: number): number {
  return redondear(valor, 4);
}

export function redondearPeso(valor: number): number {
  return redondear(valor, 0);
}

export type LineaEntrada = {
  cantidad: number;
  precioNetoUnitario: number;
  descuentoPorcentaje: number;
  aplicaIva: boolean;
};

export type LineaResultado = LineaEntrada & {
  base: number;
  netoLinea: number;
  ivaLinea: number;
  totalLinea: number;
};

export type FacturaCalculo = {
  lineas: LineaResultado[];
  netoCalculado: number;
  ivaCalculado: number;
  totalCalculado: number;
  totalEnteroSugerido: number;
  totalOficial: number;
  ajusteRedondeo: number;
  dentroDeTolerancia: boolean;
  semaforo: "Dentro de tolerancia" | "Fuera de tolerancia";
};

export function calcularLinea(entrada: LineaEntrada, porcentajeIva: number): LineaResultado {
  const base = entrada.cantidad * entrada.precioNetoUnitario;
  const netoLinea = redondear4(base * (1 - entrada.descuentoPorcentaje / 100));
  const ivaLinea = entrada.aplicaIva ? redondear4(netoLinea * (porcentajeIva / 100)) : 0;
  return {
    ...entrada,
    base,
    netoLinea,
    ivaLinea,
    totalLinea: redondear4(netoLinea + ivaLinea),
  };
}

export function calcularFactura(
  entradas: LineaEntrada[],
  porcentajeIva: number,
  totalOficial: number | null,
  toleranciaPesos: number,
): FacturaCalculo {
  const lineas = entradas.map((linea) => calcularLinea(linea, porcentajeIva));
  const netoCalculado = redondear4(lineas.reduce((suma, linea) => suma + linea.netoLinea, 0));
  const ivaCalculado = redondear4(lineas.reduce((suma, linea) => suma + linea.ivaLinea, 0));
  const totalCalculado = redondear4(netoCalculado + ivaCalculado);
  const totalEnteroSugerido = redondearPeso(totalCalculado);
  const oficial = totalOficial ?? totalEnteroSugerido;
  const ajusteRedondeo = redondear4(oficial - totalCalculado);
  const dentroDeTolerancia = Math.abs(ajusteRedondeo) <= toleranciaPesos;
  return {
    lineas,
    netoCalculado,
    ivaCalculado,
    totalCalculado,
    totalEnteroSugerido,
    totalOficial: oficial,
    ajusteRedondeo,
    dentroDeTolerancia,
    semaforo: dentroDeTolerancia ? "Dentro de tolerancia" : "Fuera de tolerancia",
  };
}
