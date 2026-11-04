import { describe, expect, it } from "vitest";
import { evaluarRapel } from "./rapel";

describe("rapel", () => {
  it("si las facturas superan al rapel, la diferencia es lo que paga la dueña", () => {
    const cierre = evaluarRapel([250000, 250000], 400000);
    expect(cierre.pagaLaDuena).toBe(100000);
    expect(cierre.diferenciaAPagar).toBe(100000);
  });

  it("si el rapel supera a las facturas, la diferencia es el monto que falta para cerrar", () => {
    const cierre = evaluarRapel([400000], 550000);
    expect(cierre.sobrante).toBe(150000);
    expect(cierre.diferenciaAPagar).toBe(150000);
    expect(cierre.pagaLaDuena).toBe(0);
  });
});
