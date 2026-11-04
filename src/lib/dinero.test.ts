import { describe, expect, it } from "vitest";
import { calcularFactura, calcularLinea } from "./dinero";

describe("dinero", () => {
  it("ajusta centavos al peso de la factura", () => {
    const resultado = calcularFactura(
      [
        { cantidad: 13, precioNetoUnitario: 52380, descuentoPorcentaje: 0, aplicaIva: true },
        { cantidad: 11.44, precioNetoUnitario: 4100, descuentoPorcentaje: 0, aplicaIva: true },
        { cantidad: 1, precioNetoUnitario: 30000, descuentoPorcentaje: 0, aplicaIva: true },
      ],
      19,
      null,
      5,
    );
    expect(resultado.netoCalculado).toBe(757844);
    expect(resultado.ivaCalculado).toBe(143990.36);
    expect(resultado.totalCalculado).toBe(901834.36);
    expect(resultado.totalEnteroSugerido).toBe(901834);
    expect(resultado.ajusteRedondeo).toBe(-0.36);
    expect(resultado.dentroDeTolerancia).toBe(true);
  });

  it("no suma IVA si la línea no aplica", () => {
    const resultado = calcularFactura(
      [
        { cantidad: 10, precioNetoUnitario: 6843.22, descuentoPorcentaje: 0, aplicaIva: false },
        { cantidad: 4, precioNetoUnitario: 4000, descuentoPorcentaje: 0, aplicaIva: false },
      ],
      19,
      null,
      5,
    );
    expect(resultado.ivaCalculado).toBe(0);
    expect(resultado.totalCalculado).toBe(84432.2);
    expect(resultado.totalEnteroSugerido).toBe(84432);
  });

  it("aplica descuento porcentual sobre la base", () => {
    const linea = calcularLinea(
      { cantidad: 2, precioNetoUnitario: 1000, descuentoPorcentaje: 10, aplicaIva: false },
      19,
    );
    expect(linea.base).toBe(2000);
    expect(linea.netoLinea).toBe(1800);
    expect(linea.ivaLinea).toBe(0);
    expect(linea.totalLinea).toBe(1800);
  });

  it("mezcla líneas con IVA y sin IVA", () => {
    const resultado = calcularFactura(
      [
        { cantidad: 1, precioNetoUnitario: 1000, descuentoPorcentaje: 0, aplicaIva: false },
        { cantidad: 1, precioNetoUnitario: 1000, descuentoPorcentaje: 0, aplicaIva: true },
      ],
      19,
      null,
      5,
    );
    expect(resultado.netoCalculado).toBe(2000);
    expect(resultado.ivaCalculado).toBe(190);
    expect(resultado.totalCalculado).toBe(2190);
  });

  it("marca la diferencia sobre la tolerancia", () => {
    const resultado = calcularFactura(
      [{ cantidad: 1, precioNetoUnitario: 1000, descuentoPorcentaje: 0, aplicaIva: true }],
      19,
      1250,
      5,
    );
    expect(resultado.dentroDeTolerancia).toBe(false);
    expect(resultado.ajusteRedondeo).toBe(60);
  });

  it("conserva el IVA con el porcentaje de la factura, no el nuevo del proveedor", () => {
    const guardada = calcularFactura(
      [{ cantidad: 1, precioNetoUnitario: 1000, descuentoPorcentaje: 0, aplicaIva: true }],
      19,
      null,
      5,
    );
    const recalculada = calcularFactura(
      [{ cantidad: 1, precioNetoUnitario: 1000, descuentoPorcentaje: 0, aplicaIva: true }],
      21,
      null,
      5,
    );
    expect(guardada.ivaCalculado).toBe(190);
    expect(recalculada.ivaCalculado).toBe(210);
  });
});
