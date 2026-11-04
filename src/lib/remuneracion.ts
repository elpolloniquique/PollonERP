export type ModoGratificacion = "ninguna" | "fija" | "legal";

export type ParametrosAnio = {
  ingresoMinimo: number;
  porcentajeGratificacion: number;
  factorTopeGratificacion: number;
  recargoHoraExtra: number;
  recargoDomingo: number;
  horasJornada: number;
  tasaFonasa: number;
  tasaCesantia: number;
  valorUf: number;
  topeImponible: number;
};

export type TramoImpuesto = { desde: number; hasta: number | null; factor: number; rebaja: number };

export type EntradaLiquidacion = {
  sueldoBase: number;
  modoGratificacion: ModoGratificacion;
  gratificacionFija: number;
  horasExtra: number;
  diasDomingo: number;
  bonoArea: number;
  colacion: number;
  colacionImponible: boolean;
  movilizacion: number;
  movilizacionImponible: boolean;
  afpTasa: number;
  afpComision: number;
  afpSeguro: number;
  salud: "fonasa" | "isapre";
  isapreUf: number;
  isaprePesos: number;
  otrosDescuentos: { nombre: string; monto: number }[];
  parametros: ParametrosAnio;
  tramos: TramoImpuesto[];
};

export type ResultadoLiquidacion = {
  haberes: { nombre: string; monto: number }[];
  descuentos: { nombre: string; monto: number }[];
  imponible: number;
  tributable: number;
  impuesto: number;
  liquido: number;
};

function peso(valor: number) {
  return Math.round(valor);
}

export function calcularLiquidacion(entrada: EntradaLiquidacion): ResultadoLiquidacion | { error: string } {
  const p = entrada.parametros;
  if (entrada.modoGratificacion === "legal" && p.ingresoMinimo <= 0) {
    return { error: "Configure el ingreso mínimo del año." };
  }
  if (p.horasJornada <= 0) return { error: "Configure las horas de la jornada." };
  if (entrada.tramos.length === 0) return { error: "Cargue la tabla de impuesto único de este año." };

  let gratificacion = 0;
  if (entrada.modoGratificacion === "fija") gratificacion = entrada.gratificacionFija;
  if (entrada.modoGratificacion === "legal") {
    const tope = p.factorTopeGratificacion * p.ingresoMinimo;
    gratificacion = Math.min(entrada.sueldoBase * p.porcentajeGratificacion, tope);
  }

  const valorHora = entrada.sueldoBase / 30 / p.horasJornada;
  const horasExtra = valorHora * (1 + p.recargoHoraExtra) * entrada.horasExtra;
  const domingo = (entrada.sueldoBase / 30) * p.recargoDomingo * entrada.diasDomingo;
  const haberes = [
    { nombre: "Sueldo base", monto: peso(entrada.sueldoBase) },
    { nombre: "Gratificación", monto: peso(gratificacion) },
    { nombre: "Horas extra", monto: peso(horasExtra) },
    { nombre: "Domingo y festivo", monto: peso(domingo) },
    { nombre: "Bono por área", monto: peso(entrada.bonoArea) },
    { nombre: "Colación", monto: peso(entrada.colacion) },
    { nombre: "Movilización", monto: peso(entrada.movilizacion) },
  ].filter((haber) => haber.monto !== 0 || haber.nombre === "Sueldo base");

  let imponible = entrada.sueldoBase + gratificacion + horasExtra + domingo + entrada.bonoArea;
  if (entrada.colacionImponible) imponible += entrada.colacion;
  if (entrada.movilizacionImponible) imponible += entrada.movilizacion;
  if (p.topeImponible > 0) imponible = Math.min(imponible, p.topeImponible);
  imponible = peso(imponible);

  const afp = peso(imponible * (entrada.afpTasa + entrada.afpComision + entrada.afpSeguro));
  const legalSalud = peso(imponible * p.tasaFonasa);
  const salud = entrada.salud === "fonasa"
    ? legalSalud
    : Math.max(legalSalud, peso(entrada.isaprePesos + entrada.isapreUf * p.valorUf));
  const cesantia = peso(imponible * p.tasaCesantia);
  const tributable = Math.max(imponible - afp - salud - cesantia, 0);
  const tramo = entrada.tramos.find((item) => tributable >= item.desde && (item.hasta === null || tributable <= item.hasta));
  if (!tramo) return { error: "La tabla de impuesto no cubre este monto tributable." };
  const impuesto = Math.max(peso(tributable * tramo.factor - tramo.rebaja), 0);
  const descuentos = [
    { nombre: "AFP", monto: afp },
    { nombre: entrada.salud === "fonasa" ? "Fonasa" : "Isapre", monto: salud },
    { nombre: "Seguro de cesantía", monto: cesantia },
    { nombre: "Impuesto único", monto: impuesto },
    ...entrada.otrosDescuentos.map((item) => ({ nombre: item.nombre, monto: peso(item.monto) })),
  ];
  const totalHaberes = haberes.reduce((suma, item) => suma + item.monto, 0);
  const totalDescuentos = descuentos.reduce((suma, item) => suma + item.monto, 0);
  return { haberes, descuentos, imponible, tributable, impuesto, liquido: totalHaberes - totalDescuentos };
}
