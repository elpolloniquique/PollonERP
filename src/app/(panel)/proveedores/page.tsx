"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatoPeso } from "@/lib/formato";
import { mostrarRut, normalizarRut } from "@/lib/rut";
import { Perfil, supabase } from "@/lib/supabase";

type Fila = { id: string; nombre: string; rut: string; activo: boolean; rapel_activo: boolean; saldo: number };

const formVacio = {
  nombre: "",
  rut: "",
  rubro: "",
  telefono: "",
  dias_credito: "30",
  correo_cobranza: "",
};

export default function Proveedores() {
  const [empresaId, setEmpresaId] = useState("");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [verInactivos, setVerInactivos] = useState(false);
  const [texto, setTexto] = useState("");
  const [panel, setPanel] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const id = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!id) return;
    setEmpresaId(id);
    const [proveedores, facturas] = await Promise.all([
      supabase().from("proveedores").select("id, nombre, rut, activo, rapel_activo").eq("empresa_id", id).order("nombre"),
      supabase().from("facturas").select("proveedor_id, saldo").eq("empresa_id", id).in("estado", ["pendiente", "pago_parcial"]),
    ]);
    const saldos = new Map<string, number>();
    for (const factura of facturas.data ?? []) {
      const proveedorId = factura.proveedor_id as string;
      saldos.set(proveedorId, (saldos.get(proveedorId) ?? 0) + Number(factura.saldo));
    }
    setFilas(((proveedores.data ?? []) as Omit<Fila, "saldo">[]).map((fila) => ({ ...fila, saldo: saldos.get(fila.id) ?? 0 })));
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = filas.filter((fila) => (verInactivos || fila.activo) && fila.nombre.toLowerCase().includes(texto.toLowerCase()));

  function abrirPanel() {
    setForm(formVacio);
    setError("");
    setPanel(true);
  }

  function cerrarPanel() {
    setPanel(false);
    setError("");
  }

  async function guardar() {
    setError("");
    if (!form.nombre.trim()) {
      setError("Escriba el nombre del proveedor.");
      return;
    }
    const dias = Number(form.dias_credito);
    if (!Number.isFinite(dias) || dias < 0 || dias > 365) {
      setError("Los días de crédito van de 0 a 365.");
      return;
    }
    let rut = "";
    if (form.rut.trim()) {
      const normal = normalizarRut(form.rut);
      if ("error" in normal) {
        setError(normal.error);
        return;
      }
      rut = normal.guardado;
    }
    setGuardando(true);
    const { data, error: fallo } = await supabase().from("proveedores").insert({
      empresa_id: empresaId,
      nombre: form.nombre.trim(),
      rut,
      rubro: form.rubro.trim(),
      telefono: form.telefono.trim(),
      correo_cobranza: form.correo_cobranza.trim(),
      dias_credito: dias,
      activo: true,
      rapel_activo: false,
      porcentaje_iva: 19,
      razon_social: "",
      giro: "",
      contacto: "",
      direccion: "",
      observaciones: "",
      banco: "",
      tipo_cuenta: "",
      numero_cuenta: "",
    }).select("id").single();
    setGuardando(false);
    if (fallo || !data) {
      setError(fallo?.message ?? "No se pudo guardar.");
      return;
    }
    cerrarPanel();
    await cargar();
    window.location.href = `/proveedores/${data.id}`;
  }

  return (
    <div className={`prov-pantalla ${panel ? "prov-con-panel" : ""}`}>
      <section className="prov-tarjeta">
        <header className="prov-cabeza">
          <div>
            <p className="prov-kicker">Operación</p>
            <h1 className="prov-titulo">Proveedores</h1>
            <p className="prov-sub">{visibles.length} visible{visibles.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" className="btn-barra btn-barra-principal" onClick={abrirPanel}>
            Agregar nuevo proveedor
          </button>
        </header>

        <div className="prov-herramientas">
          <input
            className="prov-buscar"
            placeholder="Buscar por nombre"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <label className="prov-check">
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            Ver inactivos
          </label>
        </div>

        <div className="prov-cuerpo">
          <div className="tabla-scroll escritorio-solo">
            <table className="tabla prov-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Estado</th>
                  <th>Rapel</th>
                  <th>Saldo</th>
                  <th className="prov-col-accion">Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr><td colSpan={6}>No hay proveedores con este filtro.</td></tr>
                )}
                {visibles.map((fila) => (
                  <tr key={fila.id}>
                    <td><Link href={`/proveedores/${fila.id}`}>{fila.nombre}</Link></td>
                    <td className="nowrap">{fila.rut ? mostrarRut(fila.rut) : "—"}</td>
                    <td>
                      <span className={`estado-badge ${fila.activo ? "estado-pagado" : "estado-anulado"}`}>
                        {fila.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>{fila.rapel_activo ? "Sí" : "No"}</td>
                    <td className={`nowrap ${fila.saldo > 0 ? "saldo-rojo" : ""}`}>{formatoPeso(fila.saldo)}</td>
                    <td className="prov-col-accion">
                      <Link href={`/proveedores/${fila.id}`} className="btn-barra btn-barra-ver">Ver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lista-cartas movil-solo prov-cartas">
            {visibles.length === 0 && <p className="pendientes-vacio">No hay proveedores con este filtro.</p>}
            {visibles.map((fila) => (
              <article key={fila.id} className="carta-factura prov-carta">
                <div className="carta-factura-arriba">
                  <span className="carta-factura-numero">{fila.nombre}</span>
                  <span className={`estado-badge ${fila.activo ? "estado-pagado" : "estado-anulado"}`}>
                    {fila.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="carta-factura-abajo">
                  <span>{fila.rut ? mostrarRut(fila.rut) : "Sin RUT"}{fila.rapel_activo ? " · Rapel" : ""}</span>
                  <strong className={fila.saldo > 0 ? "saldo-rojo" : ""}>{formatoPeso(fila.saldo)}</strong>
                </div>
                <div className="prov-carta-accion">
                  <Link href={`/proveedores/${fila.id}`} className="btn-barra btn-barra-ver">Ver ficha</Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {panel && (
        <>
          <button type="button" className="prov-capa" aria-label="Cerrar" onClick={cerrarPanel} />
          <aside className="prov-panel prov-panel-abierto">
            <header className="prov-panel-cabeza">
              <div>
                <p className="prov-kicker">Alta rápida</p>
                <h2 className="prov-panel-titulo">Nuevo proveedor</h2>
              </div>
              <button type="button" className="ed-factura-cerrar" aria-label="Cerrar" onClick={cerrarPanel}>×</button>
            </header>

            <div className="prov-panel-cuerpo">
              <label className="campo">
                <span className="etiqueta">Nombre</span>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Ariztia" autoFocus />
              </label>
              <label className="campo">
                <span className="etiqueta">RUT</span>
                <input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} placeholder="76.097.744-6" />
              </label>
              <label className="campo">
                <span className="etiqueta">Rubro</span>
                <input value={form.rubro} onChange={(e) => setForm({ ...form, rubro: e.target.value })} placeholder="Opcional" />
              </label>
              <label className="campo">
                <span className="etiqueta">Teléfono</span>
                <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </label>
              <label className="campo">
                <span className="etiqueta">Correo de cobranza</span>
                <input value={form.correo_cobranza} onChange={(e) => setForm({ ...form, correo_cobranza: e.target.value })} />
              </label>
              <label className="campo">
                <span className="etiqueta">Días de crédito</span>
                <input type="number" min={0} max={365} value={form.dias_credito} onChange={(e) => setForm({ ...form, dias_credito: e.target.value })} />
              </label>
              {error && <p className="error">{error}</p>}
              <p className="prov-panel-nota">Después de guardar podrá completar pagos, productos y rapel en la ficha.</p>
            </div>

            <footer className="prov-panel-pie">
              <button type="button" className="btn-barra" onClick={cerrarPanel}>Cancelar</button>
              <button type="button" className="btn-barra btn-barra-principal" disabled={guardando} onClick={() => void guardar()}>
                {guardando ? "Guardando…" : "Guardar proveedor"}
              </button>
            </footer>
          </aside>
        </>
      )}
    </div>
  );
}
