import { describe, expect, it } from "vitest";
import { mostrarRut, normalizarRut } from "./rut";
import { fechasDeIngreso, hoySantiago, semaforoVencimiento, sumarDias } from "./fechas";

describe("rut", () => {
  it("guarda sin puntos y muestra con puntos", () => {
    const rut = normalizarRut("76.097.744-6");
    expect(rut).toEqual({ guardado: "76097744-6", visible: "76.097.744-6" });
    expect(mostrarRut("76097744-6")).toBe("76.097.744-6");
  });

  it("rechaza un dígito verificador malo", () => {
    const rut = normalizarRut("76097744-1");
    expect("error" in rut).toBe(true);
  });
});

describe("fechas", () => {
  it("la emisión copia el ingreso y el vencimiento suma los días de crédito", () => {
    expect(fechasDeIngreso("2026-10-27", 15)).toEqual({
      emision: "2026-10-27",
      vencimiento: "2026-11-11",
    });
  });

  it("cero días vence el mismo día", () => {
    expect(sumarDias("2026-10-27", 0)).toBe("2026-10-27");
  });

  it("el semáforo solo tiene tres grupos dentro de siete días", () => {
    expect(semaforoVencimiento("2026-10-29", "2026-10-30")).toBe("vencida");
    expect(semaforoVencimiento("2026-11-02", "2026-10-30")).toBe("tres");
    expect(semaforoVencimiento("2026-11-06", "2026-10-30")).toBe("siete");
    expect(semaforoVencimiento("2026-11-08", "2026-10-30")).toBeNull();
  });

  it("hoy sale en calendario de Santiago", () => {
    expect(hoySantiago()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
