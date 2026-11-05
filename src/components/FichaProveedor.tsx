"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { estadoVisible, formatoPeso } from "@/lib/formato";
import { fechaCorta } from "@/lib/fechas";
import { mostrarRut, normalizarRut } from "@/lib/rut";
import { Perfil, supabase } from "@/lib/supabase";

const UNIDADES = ["Unidad", "Kilo", "Caja", "Paquete", "Balón", "Litro", "Otro"];
const PESTANAS = ["Datos", "Pagos", "Impuestos", "Rapel", "Productos", "Facturas", "Cuenta corriente"] as const;

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
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]>("Datos");
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
  const rutVisible = datos.rut ? (datos.rut.includes(".") ? datos.rut : mostrarRut(datos.rut)) : "";

  return (
    <div className="ficha-pantalla">
      <section className="ficha-tarjeta">
        <header className="ficha-cabeza">
          <div className="ficha-cabeza-texto">
            <Link className="ficha-volver" href="/proveedores">← Proveedores</Link>
            <div className="ficha-titulo-fila">
              <h1 className="ficha-titulo">{nuevo ? "Nuevo proveedor" : datos.nombre}</h1>
              {!nuevo && (
                <span className={`estado-badge ${datos.activo ? "estado-pagado" : "estado-anulado"}`}>
                  {datos.activo ? "Activo" : "Inactivo"}
                </span>
              )}
            </div>
            <p className="ficha-sub">
              {nuevo ? "Complete los datos del proveedor" : `${rutVisible || "Sin RUT"} · ${datos.dias_credito} días de crédito`}
            </p>
          </div>
        </header>

        <nav className="ficha-pestanas" aria-label="Secciones del proveedor">
          {PESTANAS.map((nombre) => (
            <button
              key={nombre}
              type="button"
              className={`ficha-pestana ${pestana === nombre ? "activa" : ""}`}
              onClick={() => setPestana(nombre)}
              disabled={nuevo && nombre !== "Datos"}
            >
              {nombre}
            </button>
          ))}
        </nav>

        <div className="ficha-cuerpo">
          {pestana === "Datos" && (
            <div className="ficha-bloque">
              <div className="ficha-grilla">
                <Campo nombre="Nombre" valor={datos.nombre} onChange={(v) => poner("nombre", v)} />
                <Campo nombre="Rubro" valor={datos.rubro} onChange={(v) => poner("rubro", v)} />
                <Campo nombre="RUT" valor={rutVisible} onChange={(v) => poner("rut", v)} />
                <Campo nombre="Razón social" valor={datos.razon_social} onChange={(v) => poner("razon_social", v)} clase="ficha-span-2" />
                <Campo nombre="Giro" valor={datos.giro} onChange={(v) => poner("giro", v)} />
                <Campo nombre="Contacto" valor={datos.contacto} onChange={(v) => poner("contacto", v)} />
                <Campo nombre="Teléfono" valor={datos.telefono} onChange={(v) => poner("telefono", v)} />
                <Campo nombre="Correo de cobranza" valor={datos.correo_cobranza} onChange={(v) => poner("correo_cobranza", v)} />
                <Campo nombre="Dirección" valor={datos.direccion} onChange={(v) => poner("direccion", v)} clase="ficha-span-3" />
                <label className="campo ficha-span-3">
                  <span className="etiqueta">Observaciones</span>
                  <textarea rows={2} value={datos.observaciones} onChange={(e) => poner("observaciones", e.target.value)} />
                </label>
              </div>
              <div className="ficha-fila-estado">
                <Campo nombre="Días de crédito" valor={String(datos.dias_credito)} onChange={(v) => poner("dias_credito", Number(v))} />
                <label className="ficha-check">
                  <input type="checkbox" checked={datos.activo} onChange={(e) => poner("activo", e.target.checked)} />
                  Proveedor activo
                </label>
              </div>
            </div>
          )}

          {pestana === "Pagos" && datos.id && (
            <div className="ficha-bloque ficha-bloque-angosto">
              <div className="ficha-grilla">
                <Campo nombre="Banco" valor={datos.banco} onChange={(v) => poner("banco", v)} />
                <Campo nombre="Tipo de cuenta" valor={datos.tipo_cuenta} onChange={(v) => poner("tipo_cuenta", v)} />
                <Campo nombre="Número de cuenta" valor={datos.numero_cuenta} onChange={(v) => poner("numero_cuenta", v)} clase="ficha-span-2" />
              </div>
              <button
                type="button"
                className="btn-barra"
                onClick={() => void navigator.clipboard.writeText(`Banco: ${datos.banco}\nTipo: ${datos.tipo_cuenta}\nCuenta: ${datos.numero_cuenta}`)}
              >
                Copiar datos de pago
              </button>
            </div>
          )}

          {pestana === "Impuestos" && datos.id && (
            <Impuestos proveedorId={datos.id} porcentaje={datos.porcentaje_iva} onPorcentaje={(v) => poner("porcentaje_iva", v)} />
          )}
          {pestana === "Rapel" && (
            <div className="ficha-bloque ficha-bloque-angosto">
              <label className="ficha-check">
                <input type="checkbox" checked={datos.rapel_activo} onChange={(e) => poner("rapel_activo", e.target.checked)} />
                Rapel activo
              </label>
              <p className="ficha-ayuda">Si está activo, este proveedor aparecerá en la opción Rapel.</p>
            </div>
          )}
          {pestana === "Productos" && datos.id && <Productos proveedorId={datos.id} />}
          {pestana === "Facturas" && datos.id && <Facturas proveedorId={datos.id} />}
          {pestana === "Cuenta corriente" && datos.id && <Cuenta proveedorId={datos.id} />}

          {error && <p className="error">{error}</p>}
          {aviso && <p className="ok">{aviso}</p>}
        </div>

        <footer className="ficha-pie">
          <Link className="btn-barra" href="/proveedores">Volver</Link>
          <div className="ficha-pie-acciones">
            {puede && !nuevo && datos.activo && (
              <button type="button" className="btn-barra" onClick={() => void desactivar()}>Desactivar</button>
            )}
            {puede && ["Datos", "Pagos", "Rapel", "Impuestos"].includes(pestana) && (
              <button type="button" className="btn-barra btn-barra-principal" onClick={() => void guardar()}>Guardar</button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

function Campo({
  nombre,
  valor,
  onChange,
  clase = "",
}: {
  nombre: string;
  valor: string;
  onChange: (valor: string) => void;
  clase?: string;
}) {
  return (
    <label className={`campo ${clase}`}>
      <span className="etiqueta">{nombre}</span>
      <input value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Impuestos({ proveedorId, porcentaje, onPorcentaje }: { proveedorId: string; porcentaje: number; onPorcentaje: (valor: number) => void }) {
  const [filas, setFilas] = useState<{ id: string; nombre: string; porcentaje: number }[]>([]);
  const [nombre, setNombre] = useState("");
  const [extra, setExtra] = useState("0");
  useEffect(() => {
    void supabase().from("impuestos_proveedor").select("id, nombre, porcentaje").eq("proveedor_id", proveedorId).then(({ data }) => setFilas((data ?? []) as typeof filas));
  }, [proveedorId]);
  return (
    <div className="ficha-bloque ficha-bloque-angosto space-y-3">
      <Campo nombre="IVA de las facturas nuevas (%)" valor={String(porcentaje)} onChange={(v) => onPorcentaje(Number(v))} />
      <p className="ficha-ayuda">Una factura ya guardada conserva el porcentaje con el que se grabó.</p>
      <div className="tabla-scroll">
        <table className="tabla ficha-tabla">
          <thead><tr><th>Impuesto</th><th>%</th></tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={2}>Sin impuestos adicionales.</td></tr>}
            {filas.map((fila) => <tr key={fila.id}><td>{fila.nombre}</td><td>{fila.porcentaje}%</td></tr>)}
          </tbody>
        </table>
      </div>
      <div className="ficha-inline">
        <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input className="ficha-input-chico" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button type="button" className="btn-barra" onClick={async () => {
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
    <div className="ficha-bloque space-y-3">
      <input className="ficha-buscar" placeholder="Filtrar productos" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <div className="tabla-scroll">
        <table className="tabla ficha-tabla">
          <thead><tr><th>Producto</th><th>Unidad</th><th>Precio neto</th></tr></thead>
          <tbody>
            {visibles.length === 0 && <tr><td colSpan={3}>Sin productos.</td></tr>}
            {visibles.map((fila) => (
              <tr key={fila.id}>
                <td>{fila.nombre}</td>
                <td>{fila.unidad}</td>
                <td>{formatoPeso(fila.precio_neto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ficha-inline">
        <input placeholder="Producto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <select value={unidad} onChange={(e) => setUnidad(e.target.value)}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select>
        <input className="ficha-input-chico" placeholder="Precio" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        <button type="button" className="btn-barra" onClick={async () => {
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
    <div className="ficha-bloque">
      <div className="tabla-scroll">
        <table className="tabla ficha-tabla">
          <thead>
            <tr>
              <th>Ingreso</th><th>Número</th><th>Neto</th><th>IVA</th><th>Total</th><th>Saldo</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={7}>Sin facturas.</td></tr>}
            {filas.map((fila) => (
              <tr key={fila.id} onDoubleClick={() => { window.location.href = `/facturas/${fila.id}`; }}>
                <td>{fechaCorta(fila.fecha_ingreso)}</td>
                <td>{fila.numero}</td>
                <td>{formatoPeso(fila.neto_calculado)}</td>
                <td>{formatoPeso(fila.iva_calculado)}</td>
                <td>{formatoPeso(fila.total_oficial)}</td>
                <td className={fila.saldo > 0 ? "saldo-rojo" : ""}>{formatoPeso(fila.saldo)}</td>
                <td>{estadoVisible(fila.estado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cuenta({ proveedorId }: { proveedorId: string }) {
  const [filas, setFilas] = useState<{ id: string; fecha_ingreso: string; numero: string; total_oficial: number; abonado: number; saldo: number; estado: string }[]>([]);
  useEffect(() => {
    void supabase().from("facturas").select("id, fecha_ingreso, numero, total_oficial, abonado, saldo, estado").eq("proveedor_id", proveedorId).neq("estado", "anulada").order("fecha_ingreso").then(({ data }) => setFilas((data ?? []) as typeof filas));
  }, [proveedorId]);
  const saldo = filas.reduce((suma, fila) => suma + Number(fila.saldo), 0);
  return (
    <div className="ficha-bloque">
      <div className="tabla-scroll">
        <table className="tabla ficha-tabla">
          <thead>
            <tr>
              <th>Fecha</th><th>Factura</th><th>Cargo</th><th>Abono</th><th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={5}>Sin movimientos.</td></tr>}
            {filas.map((fila) => (
              <tr key={fila.id}>
                <td>{fechaCorta(fila.fecha_ingreso)}</td>
                <td>{fila.numero}</td>
                <td>{formatoPeso(fila.total_oficial)}</td>
                <td>{formatoPeso(fila.abonado)}</td>
                <td className={fila.saldo > 0 ? "saldo-rojo" : ""}>{formatoPeso(fila.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ficha-saldo">Saldo {formatoPeso(saldo)}</p>
    </div>
  );
}
