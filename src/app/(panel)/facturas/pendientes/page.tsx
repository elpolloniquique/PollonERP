"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorFactura } from "@/components/EditorFactura";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { estadoVisible, formatoPeso } from "@/lib/formato";
import { copiarReportePendientes } from "@/lib/reporteImagen";
import { Perfil, supabase } from "@/lib/supabase";

type Factura = {
  id: string;
  proveedor_id: string;
  numero: string;
  fecha_ingreso: string;
  saldo: number;
  estado: string;
  reservada_rapel?: boolean;
  con_rapel?: boolean;
};
type Proveedor = { id: string; nombre: string };

type FilaHoja = {
  id: string;
  fecha: string;
  numero: string;
  saldo: number;
  estado: string;
  con_rapel?: boolean;
};

type GrupoVista = {
  id: string;
  proveedor: string;
  periodo: string;
  total: number;
  filas: FilaHoja[];
};

export default function Pendientes() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [elegido, setElegido] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [buscaFactura, setBuscaFactura] = useState("");
  const [zoomPdf, setZoomPdf] = useState(1);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [resaltadaId, setResaltadaId] = useState<string | null>(null);
  const [encontradaId, setEncontradaId] = useState<string | null>(null);
  const hojaRefs = useRef<Record<string, HTMLElement | null>>({});
  const filaRefs = useRef<Record<string, HTMLElement | null>>({});
  const buscaRef = useRef<HTMLInputElement | null>(null);

  async function cargar() {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!empresaId) return;
    const [listaProveedores, listaFacturas] = await Promise.all([
      supabase().from("proveedores").select("id, nombre").eq("empresa_id", empresaId).eq("activo", true).order("nombre"),
      supabase().from("facturas").select("id, proveedor_id, numero, fecha_ingreso, saldo, estado, reservada_rapel, con_rapel").eq("empresa_id", empresaId).in("estado", ["pendiente", "pago_parcial"]).gt("saldo", 0).order("fecha_ingreso"),
    ]);
    const crudas = (listaFacturas.error
      ? ((await supabase().from("facturas").select("id, proveedor_id, numero, fecha_ingreso, saldo, estado").eq("empresa_id", empresaId).in("estado", ["pendiente", "pago_parcial"]).gt("saldo", 0).order("fecha_ingreso")).data ?? [])
      : (listaFacturas.data ?? [])) as Factura[];
    setProveedores((listaProveedores.data ?? []) as Proveedor[]);
    setFacturas(crudas.filter((fila) => !fila.reservada_rapel));
  }

  useEffect(() => {
    void cargar();
    const canal = supabase().channel("pendientes").on("postgres_changes", { event: "*", schema: "public", table: "facturas" }, () => void cargar()).subscribe();
    return () => { void supabase().removeChannel(canal); };
  }, []);

  const mapaProveedor = useMemo(
    () => Object.fromEntries(proveedores.map((item) => [item.id, item.nombre])),
    [proveedores],
  );
  const conSaldo = useMemo(
    () => proveedores.filter((item) => facturas.some((factura) => factura.proveedor_id === item.id)),
    [proveedores, facturas],
  );
  const filtrados = useMemo(
    () => conSaldo.filter((item) => item.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [conSaldo, busqueda],
  );
  const delProveedor = facturas.filter((factura) => factura.proveedor_id === elegido);
  const total = delProveedor.reduce((suma, factura) => suma + Number(factura.saldo), 0);
  const totalGeneral = facturas.reduce((suma, factura) => suma + Number(factura.saldo), 0);
  const periodo = delProveedor.length
    ? `${fechaCorta(delProveedor[0].fecha_ingreso)} al ${fechaCorta(delProveedor[delProveedor.length - 1].fecha_ingreso)}`
    : hoySantiago();
  const nombre = proveedores.find((item) => item.id === elegido)?.nombre ?? "";
  const sinElegido = !elegido || delProveedor.length === 0;

  const hojasPdf: GrupoVista[] = useMemo(
    () => conSaldo.map((proveedor) => {
      const filas = facturas.filter((factura) => factura.proveedor_id === proveedor.id);
      const desde = filas[0]?.fecha_ingreso;
      const hasta = filas[filas.length - 1]?.fecha_ingreso;
      return {
        id: proveedor.id,
        proveedor: proveedor.nombre,
        periodo: desde && hasta ? `${fechaCorta(desde)} al ${fechaCorta(hasta)}` : hoySantiago(),
        total: filas.reduce((suma, factura) => suma + Number(factura.saldo), 0),
        filas: filas.map((factura) => ({
          id: factura.id,
          fecha: factura.fecha_ingreso,
          numero: factura.numero,
          saldo: Number(factura.saldo),
          estado: factura.estado,
          con_rapel: factura.con_rapel,
        })),
      };
    }),
    [conSaldo, facturas],
  );

  const coincidencias = useMemo(() => {
    const q = buscaFactura.trim().toLowerCase();
    if (q.length < 1) return [];
    return facturas
      .filter((factura) => factura.numero.toLowerCase().includes(q))
      .slice(0, 8)
      .map((factura) => ({
        ...factura,
        proveedor: mapaProveedor[factura.proveedor_id] ?? "Proveedor",
      }));
  }, [buscaFactura, facturas, mapaProveedor]);

  useEffect(() => {
    if (!elegido && conSaldo.length > 0) setElegido(conSaldo[0].id);
    if (elegido && !conSaldo.some((item) => item.id === elegido)) {
      setElegido(conSaldo[0]?.id ?? "");
    }
  }, [conSaldo, elegido]);

  function elegirProveedor(id: string) {
    setElegido(id);
    requestAnimationFrame(() => {
      hojaRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function localizarFactura(factura: Factura, desdeBusqueda = false) {
    setElegido(factura.proveedor_id);
    setResaltadaId(factura.id);
    if (desdeBusqueda) {
      setEncontradaId(factura.id);
      setBuscaFactura(factura.numero);
    }
    requestAnimationFrame(() => {
      hojaRefs.current[factura.proveedor_id]?.scrollIntoView({ behavior: "smooth", block: "start" });
      filaRefs.current[factura.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function modificarEncontrada() {
    if (!encontradaId) return;
    setEditandoId(encontradaId);
  }

  function cerrarEditor() {
    setEditandoId(null);
  }

  function limpiarBusqueda() {
    setBuscaFactura("");
    setResaltadaId(null);
    setEncontradaId(null);
  }

  const facturaEncontrada = encontradaId
    ? facturas.find((factura) => factura.id === encontradaId) ?? null
    : null;

  const buscador = (
    <div className="pend-busca-factura">
      <label className="pend-busca-factura-caja">
        <span className="pend-busca-factura-etiq">Buscar factura</span>
        <span className="pend-busca-factura-campo">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={buscaRef}
            value={buscaFactura}
            placeholder="Nº factura"
            onChange={(e) => {
              setBuscaFactura(e.target.value);
              setEncontradaId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && coincidencias[0]) {
                e.preventDefault();
                localizarFactura(coincidencias[0], true);
              }
              if (e.key === "Escape") limpiarBusqueda();
            }}
          />
        </span>
      </label>
      {buscaFactura.trim() && !encontradaId && (
        <div className="pend-busca-resultados">
          {coincidencias.length === 0 && (
            <p className="pend-busca-vacio">Sin coincidencias</p>
          )}
          {coincidencias.map((factura) => (
            <button
              key={factura.id}
              type="button"
              className="pend-busca-item"
              onClick={() => localizarFactura(factura, true)}
            >
              <span className="pend-busca-item-num">{factura.numero}</span>
              <span className="pend-busca-item-meta">{factura.proveedor}</span>
              <strong className="pend-busca-item-saldo">{formatoPeso(factura.saldo)}</strong>
            </button>
          ))}
        </div>
      )}
      {facturaEncontrada && (
        <div className="pend-busca-encontrada">
          <div className="pend-busca-encontrada-info">
            <span className="pend-busca-item-num">{facturaEncontrada.numero}</span>
            <span className="pend-busca-item-meta">{mapaProveedor[facturaEncontrada.proveedor_id] ?? ""}</span>
            <strong className="pend-busca-item-saldo">{formatoPeso(facturaEncontrada.saldo)}</strong>
          </div>
          <button type="button" className="btn-barra btn-barra-principal" onClick={modificarEncontrada}>
            Modificar
          </button>
        </div>
      )}
    </div>
  );

  const acciones = (
    <>
      <div className="pend-zoom escritorio-solo">
        <button type="button" className="btn-barra" disabled={zoomPdf <= 0.8} onClick={() => setZoomPdf((z) => Math.max(0.8, Number((z - 0.1).toFixed(1))))}>−</button>
        <button type="button" className="btn-barra" disabled={zoomPdf >= 1.3} onClick={() => setZoomPdf((z) => Math.min(1.3, Number((z + 0.1).toFixed(1))))}>+</button>
      </div>
      <div className="escritorio-solo">{buscador}</div>
      <a className="btn-barra" href="/facturas?nueva=1">Nueva factura</a>
      <a className="btn-barra" href="/pagos/registrar">Registrar pago</a>
      <button
        type="button"
        className="btn-barra"
        disabled={sinElegido}
        onClick={() => void copiarReportePendientes(
          delProveedor.map((factura) => ({
            fecha: factura.fecha_ingreso,
            numero: factura.numero,
            saldo: Number(factura.saldo),
            estado: factura.estado,
          })),
          nombre,
          periodo,
          total,
        )}
      >
        WhatsApp
      </button>
    </>
  );

  return (
    <div className="pend-pantalla">
      <section className="pend-tarjeta">
        <div className="pend-cuerpo">
          <aside className="pend-lista escritorio-solo">
            <div className="pend-lista-tope">
              <h1 className="pend-titulo">Pendientes</h1>
              <p className="pend-sub">
                {conSaldo.length} proveedor{conSaldo.length === 1 ? "" : "es"} · {formatoPeso(totalGeneral)}
              </p>
            </div>

            <label className="pend-buscar-caja">
              <span className="pend-buscar-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
              </span>
              <input
                className="pend-buscar"
                placeholder="Buscar proveedor"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>

            <div className="pend-lista-scroll">
              {filtrados.length === 0 && <p className="pend-vacio">Sin pendientes.</p>}
              {filtrados.map((item) => {
                const saldoProv = facturas
                  .filter((factura) => factura.proveedor_id === item.id)
                  .reduce((suma, factura) => suma + Number(factura.saldo), 0);
                const cantidad = facturas.filter((factura) => factura.proveedor_id === item.id).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`pend-proveedor ${elegido === item.id ? "activa" : ""}`}
                    onClick={() => elegirProveedor(item.id)}
                  >
                    <span className="pend-proveedor-nombre">{item.nombre}</span>
                    <span className="pend-proveedor-meta">{cantidad} factura{cantidad === 1 ? "" : "s"}</span>
                    <strong className="pend-proveedor-saldo">{formatoPeso(saldoProv)}</strong>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="pend-movil-tope movil-solo">
            <div className="pend-lista-tope">
              <h1 className="pend-titulo">Pendientes</h1>
              <p className="pend-sub">
                {conSaldo.length} proveedor{conSaldo.length === 1 ? "" : "es"} · {formatoPeso(totalGeneral)}
              </p>
            </div>
            <div className="pend-chips">
              {conSaldo.length === 0 && <p className="pend-vacio">Sin facturas pendientes.</p>}
              {conSaldo.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`pend-chip ${elegido === item.id ? "activa" : ""}`}
                  onClick={() => elegirProveedor(item.id)}
                >
                  {item.nombre}
                </button>
              ))}
            </div>
            <div className="pend-movil-busca">{buscador}</div>
          </div>

          <div className="pend-panel-der pend-panel-der-pdf">
            <div className="pend-barra-pdf escritorio-solo">Facturas pendientes</div>

            <div className="pend-panel-der-cuerpo">
              <div className="pend-detalle pend-detalle-pdf">
                <div className="pend-barra-pdf movil-solo">Facturas pendientes</div>
                <div className="pend-pdf-escenario">
                  {hojasPdf.length === 0 ? (
                    <p className="pend-vacio-pdf">No hay facturas pendientes.</p>
                  ) : (
                    <div className="pend-pdf-hojas" style={{ transform: `scale(${zoomPdf})` }}>
                      {hojasPdf.map((hoja) => (
                        <article
                          key={hoja.id}
                          className={`pend-hoja ${elegido === hoja.id ? "pend-hoja-activa" : ""}`}
                          ref={(nodo) => { hojaRefs.current[hoja.id] = nodo; }}
                        >
                          <h2 className="pend-hoja-titulo">{hoja.proveedor}</h2>
                          <div className="pend-hoja-barra">
                            <span>Facturas pendientes</span>
                            <span>Periodo {hoja.periodo}</span>
                          </div>
                          <table className="pend-hoja-tabla">
                            <thead>
                              <tr>
                                <th>Fecha</th>
                                <th>Factura</th>
                                <th>Monto</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hoja.filas.map((fila) => (
                                <tr
                                  key={fila.id}
                                  ref={(nodo) => { filaRefs.current[fila.id] = nodo; }}
                                  className={resaltadaId === fila.id ? "pend-fila-resaltada" : ""}
                                  onClick={() => {
                                    const factura = facturas.find((item) => item.id === fila.id);
                                    if (factura) localizarFactura(factura, false);
                                  }}
                                >
                                  <td>{fechaCorta(fila.fecha)}</td>
                                  <td>{fila.numero}</td>
                                  <td>{formatoPeso(fila.saldo)}</td>
                                  <td>{estadoVisible(fila.estado, Boolean(fila.con_rapel))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="pend-hoja-total">
                            <span>Total por pagar</span>
                            <strong>{formatoPeso(hoja.total)}</strong>
                          </div>
                          <p className="pend-hoja-pie">
                            {hoja.filas.length} factura{hoja.filas.length === 1 ? "" : "s"} pendiente{hoja.filas.length === 1 ? "" : "s"}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <footer className="pend-acciones pend-acciones-movil movil-solo">
                  {acciones}
                </footer>
              </div>

              <aside className="pend-acciones pend-acciones-lado escritorio-solo">
                {acciones}
              </aside>
            </div>
          </div>
        </div>
      </section>

      {editandoId && (
        <div className="factura-modal-capa" role="dialog" aria-modal="true" aria-label="Modificar factura">
          <div className="factura-modal">
            <EditorFactura
              key={editandoId}
              facturaId={editandoId}
              variante="modal"
              onCerrar={cerrarEditor}
              onGuardado={() => {
                void cargar();
                cerrarEditor();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
