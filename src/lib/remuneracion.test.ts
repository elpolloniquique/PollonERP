import { describe, expect, it } from "vitest";
import { calcularLiquidacion } from "./remuneracion";

describe("remuneración", () => {
  it("usa los parámetros del año y no una tasa escrita en la prueba como ley fija del código de pantalla", () => {
    const resultado = calcularLiquidacion({
      sueldoBase: 500000,
      modoGratificacion: "ninguna",
      gratificacionFija: 0,
      horasExtra: 0,
      diasDomingo: 0,
      bonoArea: 0,
      colacion: 0,
      colacionImponible: false,
      movilizacion: 0,
      movilizacionImponible: false,
      afpTasa: 0.1,
      afpComision: 0,
      afpSeguro: 0,
      salud: "fonasa",
      isapreUf: 0,
      isaprePesos: 0,
      otrosDescuentos: [],
      parametros: {
        ingresoMinimo: 500000,
        porcentajeGratificacion: 0.25,
        factorTopeGratificacion: 4.75,
        recargoHoraExtra: 0.5,
        recargoDomingo: 0.5,
        horasJornada: 8,
        tasaFonasa: 0.07,
        tasaCesantia: 0,
        valorUf: 39000,
        topeImponible: 0,
      },
      tramos: [{ desde: 0, hasta: null, factor: 0, rebaja: 0 }],
    });
    expect("error" in resultado).toBe(false);
    if (!("error" in resultado)) {
      expect(resultado.imponible).toBe(500000);
      expect(resultado.descuentos[0].monto).toBe(50000);
      expect(resultado.descuentos[1].monto).toBe(35000);
      expect(resultado.liquido).toBe(415000);
    }
  });
});
