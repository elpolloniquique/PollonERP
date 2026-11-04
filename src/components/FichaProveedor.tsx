"use client";

import { useEffect, useMemo, useState } from "react";
import { estadoVisible, formatoPeso } from "@/lib/formato";
import { fechaCorta } from "@/lib/fechas";
import { mostrarRut, normalizarRut } from "@/lib/rut";
import { Perfil, supabase } from "@/lib/supabase";

const UNIDADES = ["Unidad", "Kilo", "Caja", "Paquete", "Balón", "Litro", "Otro"];

type Proveedor = {
  id?: string;
  empresa_id: string;
  nombre: string;
  rubro: string;
  razon_social: string;
  rut: string;
  giro: string;
  contacto: string;
  telefono: string;
  correo_cobranza: string;
  direccion: string;
  dias_credito: number;
  observaciones: string;
  activo: boolean;
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  rapel_activo: boolean;
  porcentaje_iva: number;
};

const vacio = (empresaId: string): Proveedor => ({
  empresa_id: empresaId,
  nombre: "", rubro: "", razon_social: "", rut: "", giro: "", contacto: "", telefono: "",
  correo_cobranza: "", direccion: "", dias_credito: 30, observaciones: "", activo: true,
  banco: "", tipo_cuenta: "", numero_cuenta: "", rapel_activo: false, porcentaje_iva: 19,
});

export function FichaProveedor({ id }: { id: string }) {
  const nuevo = id === "nuevo";
  const [pestana, setPestana] = useState("Datos");
  const [datos, setDatos] = useState<Proveedor | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [puede, setPuede] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfil = await supabase().from("perfiles").select("*").eq("id", usuario.user.id).single();
      const actual = perfil.data as Perfil | null;
      if (!actual?.empresa_id) return;
      setPuede(actual.puede_modificar);
      if (nuevo) { setDatos(vacio(actual.empresa_id)); return; }
      const cargado = await supabase().from("proveedores").select("*").eq("id", id).single();
      if (cargado.error || !cargado.data) { setError("No se encontró el proveedor."); return; }
      setDatos(cargado.data as Proveedor);
    })();
  }, [id, nuevo]);

  async function guardar() {
    if (!datos) return;
    setError("");
    setAviso("");
    if (!datos.nombre.trim()) { setError("Escriba el nombre."); return; }
    if (datos.dias_credito < 0 || datos.dias_credito > 365) { setError("Los días de crédito van de 0 a 365."); return; }
    let rut = "";
    if (datos.rut.trim()) {
      const normal = normalizarRut(datos.rut);
      if ("error" in normal) { setError(normal.error); return; }
      rut = normal.guardado;
    }
    const { id: identificador, ...resto } = datos;
    const cuerpo = { ...resto, rut, nombre: datos.nombre.trim() };
    const consulta = nuevo
      ? supabase().from("proveedores").insert(cuerpo).select("id").single()
      : supabase().from("proveedores").update(cuerpo).eq("id", identificador!).select("id").single();
    const { data, error: fallo } = await consulta;
    if (fallo || !data) { setError(fallo?.message ?? "No se guardó."); return; }
    if (nuevo) window.location.href = `/proveedores/${data.id}`;
    else setAviso("Proveedor guardado.");
  }

  async function desactivar() {
    if (!datos?.id) return;
    const { error: fallo } = await supabase().from("proveedores").update({ activo: false }).eq("id", datos.id);
    if (fallo) { setError(fallo.message); return; }
    setDatos({ ...datos, activo: false });
    setAviso("Proveedor desactivado. El historial se conserva.");
  }

  if (!datos) return <main className="p-4">{error || "Cargando…"}</main>;
  const poner = (campo: keyof Proveedor, valor: string | number | boolean) => setDatos({ ...datos, [campo]: valor });

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="marco flex min-h-0 flex-1 flex-col">
        <h1 className="titulo-barra">{nuevo ? "Nuevo proveedor" : datos.nombre}</h1>
        <div className="pestanas overflow-x-auto">
          {["Datos", "Pagos", "Impuestos", "Rapel", "Productos", "Facturas", "Cuenta corriente"].map((nombre) => (
            <button key={nombre} className={pestana === nombre ? "activa" : ""} onClick={() => setPestana(nombre)} disabled={nuevo && nombre !== "Datos"}>{nombre}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {pestana === "Datos" && (
            <div className="grilla-campos">
              <Campo nombre="Nombre" valor={datos.nombre} onChange={(v) => poner("nombre", v)} />
              <Campo nombre="Rubro" valor={datos.rubro} onChange={(v) => poner("rubro", v)} />
              <Campo nombre="Razón social" valor={datos.razon_social} onChange={(v) => poner("razon_social", v)} />
              <Campo nombre="RUT" valor={datos.rut ? (datos.rut.includes(".") ? datos.rut : mostrarRut(datos.rut)) : ""} onChange={(v) => poner("rut", v)} />
              <Campo nombre="Giro" valor={datos.giro} onChange={(v) => poner("giro", v)} />
              <Campo nombre="Contacto" valor={datos.contacto} onChange={(v) => poner("contacto", v)} />
              <Campo nombre="Teléfono" valor={datos.telefono} onChange={(v) => poner("telefono", v)} />
              <Campo nombre="Correo de cobranza" valor={datos.correo_cobranza} onChange={(v) => poner("correo_cobranza", v)} />
              <Campo nombre="Dirección" valor={datos.direccion} onChange={(v) => poner("direccion", v)} />
              <Campo nombre="Días de crédito" valor={String(datos.dias_credito)} onChange={(v) => poner("dias_credito", Number(v))} />
              <label className="campo col-span-full"><span className="etiqueta">Observaciones</span><textarea rows={3} value={datos.observaciones} onChange={(e) => poner("observaciones", e.target.value)} /></label>
              <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={datos.activo} onChange={(e) => poner("activo", e.target.checked)} />Proveedor activo</label>
            </div>
          )}
          {pestana === "Pagos" && datos.id && (
            <div className="grid max-w-md gap-3">
              <Campo nombre="Banco" valor={datos.banco} onChange={(v) => poner("banco", v)} />
              <Campo nombre="Tipo de cuenta" valor={datos.tipo_cuenta} onChange={(v) => poner("tipo_cuenta", v)} />
              <Campo nombre="Número de cuenta" valor={datos.numero_cuenta} onChange={(v) => poner("numero_cuenta", v)} />
              <button className="btn w-fit" onClick={() => navigator.clipboard.writeText(`Banco: ${datos.banco}\nTipo: ${datos.tipo_cuenta}\nCuenta: ${datos.numero_cuenta}`)}>Copiar datos de pago</button>
            </div>
          )}
          {pestana === "Impuestos" && datos.id && <Impuestos proveedorId={datos.id} porcentaje={datos.porcentaje_iva} onPorcentaje={(v) => poner("porcentaje_iva", v)} />}
          {pestana === "Rapel" && <label className="flex items-center gap-2"><input className="w-auto" type="checkbox" checked={datos.rapel_activo} onChange={(e) => poner("rapel_activo", e.target.checked)} />Rapel activo</label>}
          {pestana === "Productos" && datos.id && <Productos proveedorId={datos.id} />}
          {pestana === "Facturas" && datos.id && <Facturas proveedorId={datos.id} />}
          {pestana === "Cuenta corriente" && datos.id && <Cuenta proveedorId={datos.id} />}
          {error && <p className="error mt-3">{error}</p>}
          {aviso && <p className="ok mt-3">{aviso}</p>}
        </div>
        <div className="flex gap-2 border-t border-[#d5e4e1] p-3">
          {puede && ["Datos", "Pagos", "Rapel", "Impuestos"].includes(pestana) && <button className="btn btn-solido" onClick={guardar}>Guardar</button>}
          {puede && !nuevo && datos.activo && <button className="btn" onClick={desactivar}>Desactivar</button>}
        </div>
      </div>
    </div>
  );
}

function Campo({ nombre, valor, onChange }: { nombre: string; valor: string; onChange: (valor: string) => void }) {
  return <label className="campo"><span className="etiqueta">{nombre}</span><input value={valor} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Impuestos({ proveedorId, porcentaje, onPorcentaje }: { proveedorId: string; porcentaje: number; onPorcentaje: (valor: number) => void }) {
  const [filas, setFilas] = useState<{ id: string; nombre: string; porcentaje: number }[]>([]);
  const [nombre, setNombre] = useState("");
  const [extra, setExtra] = useState("0");
  useEffect(() => {
    void supabase().from("impuestos_proveedor").select("id, nombre, porcentaje").eq("proveedor_id", proveedorId).then(({ data }) => setFilas((data ?? []) as typeof filas));
  }, [proveedorId]);
  return (
    <div className="max-w-lg space-y-3">
      <label className="campo"><span className="etiqueta">IVA de las facturas nuevas (%)</span><input value={porcentaje} onChange={(e) => onPorcentaje(Number(e.target.value))} /></label>
      <p className="text-[#3e5552]">Una factura ya guardada conserva el porcentaje con el que se grabó.</p>
      <table className="tabla"><tbody>{filas.map((fila) => <tr key={fila.id}><td>{fila.nombre}</td><td>{fila.porcentaje}%</td></tr>)}</tbody></table>
      <div className="flex gap-2">
        <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="w-24" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button className="btn" onClick={async () => {
          if (!nombre.trim()) return;
          await supabase().from("impuestos_proveedor").insert({ proveedor_id: proveedorId, nombre, porcentaje: Number(extra) });
          const { data } = await supabase().from("impuestos_proveedor").select("id, nombre, porcentaje").eq("proveedor_id", proveedorId);
          setFilas((data ?? []) as typeof filas);
          setNombre("");
        }}>Agregar</button>
      </div>
    </div>
  );
}

function Productos({ proveedorId }: { proveedorId: string }) {
  const [filas, setFilas] = useState<{ id: string; nombre: string; unidad: string; precio_neto: number }[]>([]);
  const [filtro, setFiltro] = useState("");
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("Unidad");
  const [precio, setPrecio] = useState("");
  const visibles = useMemo(() => filas.filter((fila) => fila.nombre.toLowerCase().includes(filtro.toLowerCase())), [filas, filtro]);
  async function recargar() {
    const { data } = await supabase().from("productos").select("id, nombre, unidad, precio_neto").eq("proveedor_id", proveedorId).eq("activo", true).order("nombre");
    setFilas((data ?? []) as typeof filas);
  }
  useEffect(() => { void recargar(); }, [proveedorId]);
  return (
    <div className="space-y-3">
      <input className="max-w-xs" placeholder="Filtrar" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <table className="tabla">
        <thead><tr><th>Producto</th><th>Unidad</th><th className="text-right">Precio neto</th></tr></thead>
        <tbody>{visibles.map((fila) => <tr key={fila.id}><td>{fila.nombre}</td><td>{fila.unidad}</td><td className="text-right">{formatoPeso(fila.precio_neto)}</td></tr>)}</tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <input className="max-w-xs" placeholder="Producto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <select className="w-32" value={unidad} onChange={(e) => setUnidad(e.target.value)}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select>
        <input className="w-32" placeholder="Precio neto" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        <button className="btn" onClick={async () => {
          if (!nombre.trim()) return;
          await supabase().from("productos").insert({ proveedor_id: proveedorId, nombre, unidad, precio_neto: Number(precio) || 0 });
          setNombre(""); setPrecio("");
          await recargar();
        }}>Agregar</button>
      </div>
    </div>
  );
}

function Facturas({ proveedorId }: { proveedorId: string }) {
  const [filas, setFilas] = useState<{ id: string; fecha_ingreso: string; numero: string; neto_calculado: number; iva_calculado: number; total_oficial: number; saldo: number; estado: string }[]>([]);
  useEffect(() => {
    void supabase().from("facturas").select("id, fecha_ingreso, numero, neto_calculado, iva_calculado, total_oficial, saldo, estado").eq("proveedor_id", proveedorId).order("fecha_ingreso", { ascending: false }).then(({ data }) => setFilas((data ?? []) as typeof filas));
  }, [proveedorId]);
  return (
    <table className="tabla">
      <thead><tr><th>Ingreso</th><th>Número</th><th>Neto</th><th>IVA</th><th>Total</th><th>Saldo</th><th>Estado</th></tr></thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.id} onDoubleClick={() => { window.location.href = `/facturas/${fila.id}`; }}>
            <td>{fechaCorta(fila.fecha_ingreso)}</td><td>{fila.numero}</td><td>{formatoPeso(fila.neto_calculado)}</td><td>{formatoPeso(fila.iva_calculado)}</td><td>{formatoPeso(fila.total_oficial)}</td><td>{formatoPeso(fila.saldo)}</td><td>{estadoVisible(fila.estado)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Cuenta({ proveedorId }: { proveedorId: string }) {
  const [filas, setFilas] = useState<{ id: string; fecha_ingreso: string; numero: string; total_oficial: number; abonado: number; saldo: number; estado: string }[]>([]);
  useEffect(() => {
    void supabase().from("facturas").select("id, fecha_ingreso, numero, total_oficial, abonado, saldo, estado").eq("proveedor_id", proveedorId).neq("estado", "anulada").order("fecha_ingreso").then(({ data }) => setFilas((data ?? []) as typeof filas));
  }, [proveedorId]);
  const saldo = filas.reduce((suma, fila) => suma + Number(fila.saldo), 0);
  return (
    <div>
      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Factura</th><th className="text-right">Cargo</th><th className="text-right">Abono</th><th className="text-right">Saldo</th></tr></thead>
        <tbody>{filas.map((fila) => <tr key={fila.id}><td>{fechaCorta(fila.fecha_ingreso)}</td><td>{fila.numero}</td><td className="text-right">{formatoPeso(fila.total_oficial)}</td><td className="text-right">{formatoPeso(fila.abonado)}</td><td className="text-right">{formatoPeso(fila.saldo)}</td></tr>)}</tbody>
      </table>
      <p className="mt-2 text-right font-semibold">Saldo {formatoPeso(saldo)}</p>
    </div>
  );
}
