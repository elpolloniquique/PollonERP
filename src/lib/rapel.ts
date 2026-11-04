export type CierreRapel = {
  suma: number;
  montoRapel: number;
  cubierto: number;
  pagaLaDuena: number;
  sobrante: number;
  diferenciaAPagar: number;
  puedeCerrar: boolean;
  mensaje: string;
};

/** La pantalla siempre llama Diferencia a pagar al monto que falta para cerrar. */
export function evaluarRapel(saldos: number[], montoRapel: number): CierreRapel {
  const suma = saldos.reduce((total, saldo) => total + saldo, 0);
  if (saldos.length === 0 || montoRapel <= 0) {
    return { suma, montoRapel, cubierto: 0, pagaLaDuena: 0, sobrante: 0, diferenciaAPagar: 0, puedeCerrar: false, mensaje: "Elija facturas y un rapel mayor que cero." };
  }
  const cubierto = Math.min(suma, montoRapel);
  const pagaLaDuena = Math.max(suma - cubierto, 0);
  const sobrante = Math.max(montoRapel - cubierto, 0);
  const diferenciaAPagar = pagaLaDuena > 0 ? pagaLaDuena : sobrante;
  return {
    suma,
    montoRapel,
    cubierto,
    pagaLaDuena,
    sobrante,
    diferenciaAPagar,
    puedeCerrar: true,
    mensaje: diferenciaAPagar === 0
      ? "El rapel cubre las facturas. No hay diferencia a pagar."
      : `Diferencia a pagar ${diferenciaAPagar}.`,
  };
}
