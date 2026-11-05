"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatoPeso, parseMonto, textoMonto } from "@/lib/formato";

export type ProductoOpcion = {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  precio_neto: number;
  descuento_porcentaje: number;
  aplica_iva: boolean;
};

export type CapturaLinea = {
  productoId: string;
  codigo: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precioNetoUnitario: number;
  descuentoPorcentaje: number;
  aplicaIva: boolean;
};

export function DialogoProducto({
  productos,
  porcentajeIva,
  actual,
  onAgregar,
  onCerrar,
}: {
  productos: ProductoOpcion[];
  porcentajeIva: number;
  actual: CapturaLinea | null;
  onAgregar: (linea: CapturaLinea) => void;
  onCerrar: (agregados: number) => void;
}) {
  const modificar = actual !== null;
  const buscarRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState<ProductoOpcion | null>(null);
  const [cantidadTexto, setCantidadTexto] = useState("");
  const [precioTexto, setPrecioTexto] = useState("");
  const [conIva, setConIva] = useState(true);
  const [agregados, setAgregados] = useState(0);
  const [escribiendo, setEscribiendo] = useState(false);
  const cantidad = parseMonto(cantidadTexto);
  const totalNeto = parseMonto(precioTexto);

  const visibles = useMemo(() => {
    const filtro = texto.trim().toLowerCase();
    if (!filtro) return productos;
    return productos.filter((producto) => producto.nombre.toLowerCase().includes(filtro) || producto.codigo.toLowerCase().includes(filtro));
  }, [productos, texto]);

  useEffect(() => {
    if (!actual) {
      buscarRef.current?.focus();
      return;
    }
    const producto = productos.find((item) => item.id === actual.productoId)
      ?? productos.find((item) => item.codigo === actual.codigo)
      ?? null;
    setElegido(producto);
    setCantidadTexto(String(actual.cantidad).replace(".", ","));
    setPrecioTexto(formatoPeso(actual.cantidad * actual.precioNetoUnitario));
    setConIva(actual.aplicaIva);
  }, [actual, productos]);

  function elegir(producto: ProductoOpcion, conservarMontos: boolean) {
    setElegido(producto);
    if (!conservarMontos) {
      setCantidadTexto("");
      setPrecioTexto("");
      setConIva(producto.aplica_iva);
    }
  }

  function alCambiarCantidad(valor: string) {
    setCantidadTexto(valor);
    const producto = elegido;
    const nueva = parseMonto(valor);
    if (!escribiendo && producto && producto.precio_neto > 0 && nueva && nueva > 0) {
      setEscribiendo(true);
      setPrecioTexto(formatoPeso(nueva * Number(producto.precio_neto)));
      setEscribiendo(false);
    }
  }

  const cantidadOk = cantidad !== null && cantidad > 0;
  const totalOk = totalNeto !== null && totalNeto > 0;
  const listo = elegido !== null && cantidadOk && totalOk;
  const unitario = listo ? totalNeto! / cantidad! : 0;
  const porKilo = (elegido?.unidad ?? "").toLowerCase().includes("kil");
  const nota = modificar
    ? "Corrija cantidad y precio"
    : agregados === 0
      ? "Doble clic o Enter en el producto"
      : `Agregados: ${agregados}. Busque otro producto`;

  function grabar() {
    if (!elegido || !cantidadOk || !totalOk) return;
    onAgregar({
      productoId: elegido.id,
      codigo: elegido.codigo,
      nombre: elegido.nombre,
      unidad: elegido.unidad || "Unidad",
      cantidad: cantidad!,
      precioNetoUnitario: totalNeto! / cantidad!,
      descuentoPorcentaje: Number(elegido.descuento_porcentaje) || 0,
      aplicaIva: conIva,
    });
    if (modificar) {
      onCerrar(1);
      return;
    }
    setAgregados(agregados + 1);
    setElegido(null);
    setTexto("");
    setCantidadTexto("");
    setPrecioTexto("");
    buscarRef.current?.focus();
  }

  function enterBuscar() {
    if (visibles.length === 1) elegir(visibles[0], false);
    else if (elegido) elegir(elegido, false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#10211f]/45 p-0 sm:items-center sm:p-4">
      <section className="marco flex h-[96dvh] w-full max-w-full flex-col rounded-b-none sm:h-auto sm:max-h-[92dvh] sm:w-[700px] sm:rounded-[12px]">
        <h2 className="titulo-barra text-center">{modificar ? "Modificar producto" : "Agregar producto"}</h2>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
          <label className="campo">
            <span className="etiqueta">Buscar producto</span>
            <input
              ref={buscarRef}
              disabled={modificar}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enterBuscar(); } }}
            />
          </label>
          <div className="grid gap-3 lg:grid-cols-[248px_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="grid grid-cols-[72px_1fr] items-center gap-2">
              <span>Producto</span>
              <input readOnly value={elegido?.nombre ?? ""} className="bg-[#E6E6E6]" />
            </div>
            <label className="campo">
              <span className="etiqueta">Cantidad</span>
              <div className="flex gap-2">
                <input value={cantidadTexto} onChange={(e) => alCambiarCantidad(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("precio-total-neto")?.focus(); } }} />
                <span className="flex w-[78px] items-center justify-center border border-[#D5E4E1] bg-[#E7F4F2] font-semibold">{elegido?.unidad || "Unidad"}</span>
              </div>
            </label>
            <label className="campo">
              <span className="etiqueta">Precio total neto</span>
              <input id="precio-total-neto" inputMode="numeric" placeholder="$ 0" value={precioTexto} onChange={(e) => { if (!escribiendo) setPrecioTexto(textoMonto(e.target.value)); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); grabar(); } }} />
            </label>
            <div className="flex items-center justify-between border border-[#2436F0] bg-[#F4F6FF] px-2 py-1.5">
              <span className="text-[#2436F0]">{porKilo ? "Precio por kilo" : "Precio unitario"}</span>
              <strong className="text-[#2436F0]">{listo ? formatoPeso(unitario) : "—"}</strong>
            </div>
            <div className="flex items-center justify-between border border-[#2436F0] bg-[#F4F6FF] px-2 py-1.5">
              <span className="text-[#2436F0]">Precio con IVA</span>
              <strong className="text-[#2436F0]">{listo ? formatoPeso(unitario * (1 + porcentajeIva / 100)) : "—"}</strong>
            </div>
            <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)} />Con IVA</label>
          </div>
          <div className="min-h-[220px] overflow-auto border border-[#2436F0]">
            <table className="tabla">
              <thead><tr><th>Código</th><th>Artículo</th><th>Unidad</th></tr></thead>
              <tbody>
                {visibles.map((producto) => (
                  <tr
                    key={producto.id}
                    className={elegido?.id === producto.id ? "elegida" : ""}
                    onClick={() => setElegido(producto)}
                    onDoubleClick={() => elegir(producto, modificar)}
                    onKeyDown={(e) => { if (e.key === "Enter") elegir(producto, modificar); }}
                    tabIndex={0}
                  >
                    <td>{producto.codigo}</td>
                    <td className="text-left">{producto.nombre}</td>
                    <td>{producto.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <p className="text-[#5E6E6C]">{nota}</p>
          <div className="flex gap-2">
            <button className="btn btn-solido min-w-24" disabled={!listo} onClick={grabar}>Grabar</button>
            <button className="btn btn-peligro min-w-20" onClick={() => onCerrar(agregados)}>Salir</button>
          </div>
        </div>
      </section>
    </div>
  );
}
