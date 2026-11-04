"use client";

import { useEffect, useMemo, useState } from "react";
import { hoySantiago } from "@/lib/fechas";
import { formatoPeso } from "@/lib/formato";
import { pdfLiquidacion } from "@/lib/exportar";
import { Perfil, supabase } from "@/lib/supabase";

type Fila = { producto: string; proveedor: string; unidad: string; cantidad: number; monto: number };

function descargarCsv(filas: Fila[]) {
  const texto = ["Producto;Proveedor;Unidad;Cantidad;Monto", ...filas.map((fila) => `${fila.producto};${fila.proveedor};${fila.unidad};${fila.cantidad};${fila.monto}`)].join("\n");
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob(["\uFEFF" + texto], { type: "text/csv" }));
  enlace.download = "productos.csv";
  enlace.click();
}

export default function Productos() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; nombre: string }[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  async function consultar() {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!empresaId) return;
    const lista = await supabase().from("proveedores").select("id, nombre").eq("empresa_id", empresaId).order("nombre");
    setProveedores((lista.data ?? []) as { id: string; nombre: string }[]);
    const lineas = await supabase().from("factura_lineas").select("descripcion, unidad, cantidad, neto_linea, facturas!inner(empresa_id, estado, fecha_ingreso, proveedor_id, proveedores(nombre))").eq("facturas.empresa_id", empresaId);
    const hoy = hoySantiago();
    const inicio = desde || `${hoy.slice(0, 4)}-01-01`;
    const fin = hasta || hoy;
    const grupos = new Map<string, Fila>();
    for (const linea of (lineas.data ?? []) as Record<string, unknown>[]) {
      const factura = (Array.isArray(linea.facturas) ? linea.facturas[0] : linea.facturas) as { estado: string; fecha_ingreso: string; proveedor_id: string; proveedores: { nombre: string } | { nombre: string }[] } | null;
      if (!factura || factura.estado === "anulada") continue;
      if (factura.fecha_ingreso < inicio || factura.fecha_ingreso > fin) continue;
      if (proveedorId && factura.proveedor_id !== proveedorId) continue;
      const proveedor = Array.isArray(factura.proveedores) ? factura.proveedores[0]?.nombre : factura.proveedores?.nombre;
      const clave = `${linea.descripcion}|${proveedor}|${linea.unidad}`;
      const actual = grupos.get(clave) ?? { producto: String(linea.descripcion), proveedor: proveedor ?? "", unidad: String(linea.unidad), cantidad: 0, monto: 0 };
      actual.cantidad += Number(linea.cantidad);
      actual.monto += Number(linea.neto_linea);
      grupos.set(clave, actual);
    }
    setFilas([...grupos.values()].sort((a, b) => a.producto.localeCompare(b.producto, "es")));
  }

  useEffect(() => { void consultar(); }, []);
  const total = filas.reduce((suma, fila) => suma + fila.monto, 0);
  const lineasPdf = useMemo(() => [...filas.map((fila) => `${fila.producto} · ${fila.proveedor} · ${fila.unidad} · ${fila.cantidad} · ${formatoPeso(fila.monto)}`), `Total ${formatoPeso(total)}`], [filas, total]);

  return (
    <div className="space-y-3 p-3">
      <h1 className="titulo-barra">Consultar productos</h1>
      <div className="grid gap-2 md:grid-cols-4">
        <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}><option value="">Todos</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button className="btn btn-solido" onClick={() => void consultar()}>Consultar</button>
      </div>
      <div className="marco overflow-auto">
        <table className="tabla">
          <thead><tr><th>Producto</th><th>Proveedor</th><th>Unidad</th><th>Cantidad</th><th>Monto</th></tr></thead>
          <tbody>{filas.map((fila) => <tr key={`${fila.producto}-${fila.proveedor}`}><td>{fila.producto}</td><td>{fila.proveedor}</td><td>{fila.unidad}</td><td>{fila.cantidad}</td><td>{formatoPeso(fila.monto)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="font-semibold">Total {formatoPeso(total)}</p>
      <div className="flex gap-2">
        <button className="btn" onClick={() => descargarCsv(filas)}>Excel</button>
        <button className="btn" onClick={() => void pdfLiquidacion("Consultar productos", lineasPdf)}>PDF</button>
      </div>
    </div>
  );
}
