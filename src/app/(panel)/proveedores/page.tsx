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

  const cargar = useCallback(async () => {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const id = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!id) return;
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
                      <button type="button" className="btn-barra btn-barra-ver" onClick={() => setFichaId(fila.id)}>
                        Ver
                      </button>
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
                <button type="button" className="prov-carta-btn" onClick={() => setFichaId(fila.id)}>
                  Ver ficha
                </button>
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
    </div>
  );
}
