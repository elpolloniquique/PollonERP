import { supabase } from "./supabase";

export async function aplicarPago(opciones: {
  empresaId: string;
  proveedorId: string;
  fecha: string;
  monto: number;
  observacion: string;
  esAbono: boolean;
  facturas: { id: string; abonado: number; total: number; aplicar: number }[];
}) {
  const pago = await supabase().from("pagos").insert({
    empresa_id: opciones.empresaId,
    proveedor_id: opciones.proveedorId,
    fecha: opciones.fecha,
    monto: opciones.monto,
    medio: "transferencia",
    observacion: opciones.observacion,
    es_abono: opciones.esAbono,
  }).select("id").single();
  if (pago.error || !pago.data) return pago.error?.message ?? "No se registró el pago.";

  for (const factura of opciones.facturas) {
    const actualizado = await supabase().from("facturas").update({
      abonado: factura.abonado + factura.aplicar,
    }).eq("id", factura.id);
    if (actualizado.error) return actualizado.error.message;
    if (factura.aplicar > 0) {
      const vinculo = await supabase().from("pago_facturas").insert({
        pago_id: pago.data.id,
        factura_id: factura.id,
        monto: factura.aplicar,
      });
      if (vinculo.error) return vinculo.error.message;
    }
  }
  return null;
}
