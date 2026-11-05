"use client";

import { useCallback, useEffect, useState } from "react";
import { FichaProveedor } from "@/components/FichaProveedor";
import { formatoPeso } from "@/lib/formato";
import { mostrarRut } from "@/lib/rut";
import { Perfil, supabase } from "@/lib/supabase";

type Fila = { id: string; nombre: string; rut: string; activo: boolean; rapel_activo: boolean; saldo: number };

export default function Proveedores() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [verInactivos, setVerInactivos] = useState(false);
  const [texto, setTexto] = useState("");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [puedeEliminar, setPuedeEliminar] = useState(false);
  const [borrar, setBorrar] = useState<Fila | null>(null);
  const [clave, setClave] = useState("");
  const [errorBorrar, setErrorBorrar] = useState("");
  const [borrando, setBorrando] = useState(false);

  const cargar = useCallback(async () => {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id, puede_eliminar").eq("id", usuario.user.id).single();
    const actual = perfil.data as Pick<Perfil, "empresa_id" | "puede_eliminar"> | null;
    const id = actual?.empresa_id;
    if (!id) return;
    setPuedeEliminar(Boolean(actual.puede_eliminar));
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
  const saldoFicha = fichaId && fichaId !== "nuevo"
    ? (filas.find((fila) => fila.id === fichaId)?.saldo ?? 0)
    : 0;

  function cerrarFicha() {
    setFichaId(null);
    void cargar();
  }

  function abrirBorrar(fila: Fila) {
    setBorrar(fila);
    setClave("");
    setErrorBorrar("");
  }

  function cerrarBorrar() {
    if (borrando) return;
    setBorrar(null);
    setClave("");
    setErrorBorrar("");
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    setErrorBorrar("");
    if (!clave.trim()) {
      setErrorBorrar("Escriba su contraseña.");
      return;
    }
    setBorrando(true);
    const { data: usuario } = await supabase().auth.getUser();
    const correo = usuario.user?.email;
    if (!correo) {
      setBorrando(false);
      setErrorBorrar("No hay sesión activa.");
      return;
    }
    const { error: claveMala } = await supabase().auth.signInWithPassword({ email: correo, password: clave });
    if (claveMala) {
      setBorrando(false);
      setErrorBorrar("La contraseña no coincide.");
      return;
    }
    const { error: fallo } = await supabase().rpc("eliminar_proveedor", { p_id: borrar.id });
    setBorrando(false);
    if (fallo) {
      setErrorBorrar(fallo.message || "No se pudo eliminar el proveedor.");
      return;
    }
    if (fichaId === borrar.id) setFichaId(null);
    setBorrar(null);
    setClave("");
    await cargar();
  }

  return (
    <div className="prov-pantalla">
      <section className="prov-tarjeta">
        <header className="prov-cabeza">
          <div>
            <p className="prov-kicker">Operación</p>
            <h1 className="prov-titulo">Proveedores</h1>
            <p className="prov-sub">{visibles.length} visible{visibles.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" className="btn-barra btn-barra-principal prov-btn-agregar" onClick={() => setFichaId("nuevo")}>
            Agregar nuevo proveedor
          </button>
        </header>

        <div className="prov-herramientas">
          <label className="prov-buscar-caja">
            <span className="prov-buscar-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="prov-buscar"
              placeholder="Buscar por nombre"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <label className="prov-switch">
            <span>Ver inactivos</span>
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
            />
            <span className="prov-switch-pista" aria-hidden="true" />
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
                    <td>
                      <button type="button" className="prov-nombre-btn" onClick={() => setFichaId(fila.id)}>
                        {fila.nombre}
                      </button>
                    </td>
                    <td className="nowrap">{fila.rut ? mostrarRut(fila.rut) : "—"}</td>
                    <td>
                      <span className={`estado-badge ${fila.activo ? "estado-pagado" : "estado-anulado"}`}>
                        {fila.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>{fila.rapel_activo ? "Sí" : "No"}</td>
                    <td className={`nowrap ${fila.saldo > 0 ? "saldo-rojo" : ""}`}>{formatoPeso(fila.saldo)}</td>
                    <td className="prov-col-accion">
                      <div className="prov-acciones">
                        <button type="button" className="btn-barra btn-barra-ver" onClick={() => setFichaId(fila.id)}>
                          Ver
                        </button>
                        {puedeEliminar && (
                          <button
                            type="button"
                            className="prov-btn-eliminar"
                            title="Eliminar proveedor"
                            aria-label={`Eliminar ${fila.nombre}`}
                            onClick={() => abrirBorrar(fila)}
                          >
                            <IconoBasura />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lista-cartas movil-solo prov-cartas">
            {visibles.length === 0 && <p className="pendientes-vacio">No hay proveedores con este filtro.</p>}
            {visibles.map((fila) => (
              <article key={fila.id} className="prov-carta">
                <div className="prov-carta-cabeza">
                  <h2 className="prov-carta-nombre">{fila.nombre}</h2>
                  <span className={`estado-badge ${fila.activo ? "estado-pagado" : "estado-anulado"}`}>
                    {fila.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="prov-carta-fila">
                  <span className="prov-carta-meta">
                    {fila.rut ? mostrarRut(fila.rut) : "Sin RUT"}
                    {fila.rapel_activo ? " · Rapel" : ""}
                  </span>
                  <strong className={`prov-carta-monto ${fila.saldo > 0 ? "saldo-rojo" : ""}`}>
                    {formatoPeso(fila.saldo)}
                  </strong>
                </div>
                <div className="prov-carta-acciones">
                  <button type="button" className="prov-carta-btn" onClick={() => setFichaId(fila.id)}>
                    Ver ficha
                  </button>
                  {puedeEliminar && (
                    <button
                      type="button"
                      className="prov-btn-eliminar"
                      title="Eliminar proveedor"
                      aria-label={`Eliminar ${fila.nombre}`}
                      onClick={() => abrirBorrar(fila)}
                    >
                      <IconoBasura />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {fichaId && (
        <div className="prov-ficha-capa" role="dialog" aria-modal="true" aria-label="Ficha de proveedor">
          <button type="button" className="prov-ficha-fondo" aria-label="Cerrar" onClick={cerrarFicha} />
          <FichaProveedor
            id={fichaId}
            saldo={saldoFicha}
            modo="modal"
            onCerrar={cerrarFicha}
            onGuardado={(id) => {
              setFichaId(id);
              void cargar();
            }}
          />
        </div>
      )}

      {borrar && (
        <div className="prov-borrar-capa" role="dialog" aria-modal="true" aria-label="Confirmar eliminación">
          <button type="button" className="prov-ficha-fondo" aria-label="Cerrar" onClick={cerrarBorrar} />
          <section className="prov-borrar-modal">
            <header className="prov-borrar-cabeza">
              <div>
                <p className="prov-kicker">Confirmación</p>
                <h2 className="prov-borrar-titulo">Eliminar proveedor</h2>
              </div>
              <button type="button" className="ed-factura-cerrar" aria-label="Cerrar" onClick={cerrarBorrar}>×</button>
            </header>
            <div className="prov-borrar-cuerpo">
              <p>
                Se eliminará <strong>{borrar.nombre}</strong> con todos sus productos, facturas, pagos y datos relacionados.
                Esta acción no se puede deshacer.
              </p>
              <label className="campo">
                <span className="etiqueta">Contraseña</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void confirmarBorrar(); }}
                />
              </label>
              {errorBorrar && <p className="error">{errorBorrar}</p>}
            </div>
            <footer className="prov-borrar-pie">
              <button type="button" className="btn-barra" disabled={borrando} onClick={cerrarBorrar}>Cancelar</button>
              <button type="button" className="btn-barra prov-borrar-confirmar" disabled={borrando} onClick={() => void confirmarBorrar()}>
                {borrando ? "Eliminando…" : "Eliminar"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function IconoBasura() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}
