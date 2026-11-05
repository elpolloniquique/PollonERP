"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { EditorFactura } from "@/components/EditorFactura";
import { fechaCorta, hoySantiago } from "@/lib/fechas";
import { estadoVisible, formatoPeso } from "@/lib/formato";
import { Perfil, supabase } from "@/lib/supabase";

type Fila = {
  id: string;
  proveedor: string;
  numero: string;
  fecha_ingreso: string;
  neto_calculado: number;
  iva_calculado: number;
  total_oficial: number;
  saldo: number;
  estado: string;
  con_rapel?: boolean;
};

function PanelFacturas() {
  const router = useRouter();
  const params = useSearchParams();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [elegida, setElegida] = useState("");
  const [indice, setIndice] = useState(0);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [editor, setEditor] = useState<"nueva" | string | null>(null);
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    const { data: usuario } = await supabase().auth.getUser();
    if (!usuario.user) return;
    const perfil = await supabase().from("perfiles").select("empresa_id").eq("id", usuario.user.id).single();
    const empresaId = (perfil.data as Pick<Perfil, "empresa_id"> | null)?.empresa_id;
    if (!empresaId) return;
    const consulta = await supabase()
      .from("facturas")
      .select("id, numero, fecha_ingreso, neto_calculado, iva_calculado, total_oficial, saldo, estado, con_rapel, proveedores(nombre)")
      .eq("empresa_id", empresaId)
      .order("fecha_ingreso", { ascending: false })
      .order("numero", { ascending: false });
    const datos = consulta.error
      ? (await supabase()
          .from("facturas")
          .select("id, numero, fecha_ingreso, neto_calculado, iva_calculado, total_oficial, saldo, estado, proveedores(nombre)")
          .eq("empresa_id", empresaId)
          .order("fecha_ingreso", { ascending: false })).data
      : consulta.data;
    const lista = ((datos ?? []) as Record<string, unknown>[]).map((fila) => {
      const proveedor = Array.isArray(fila.proveedores) ? fila.proveedores[0] : fila.proveedores;
      return {
        id: String(fila.id),
        proveedor: (proveedor as { nombre?: string } | null)?.nombre ?? "",
        numero: String(fila.numero),
        fecha_ingreso: String(fila.fecha_ingreso),
        neto_calculado: Number(fila.neto_calculado),
        iva_calculado: Number(fila.iva_calculado),
        total_oficial: Number(fila.total_oficial),
        saldo: Number(fila.saldo),
        estado: String(fila.estado),
        con_rapel: Boolean(fila.con_rapel),
      } satisfies Fila;
    });
    setFilas(lista);
    setAviso("");
  }, []);

  useEffect(() => {
    void cargar();
    const canal = supabase().channel("panel-facturas").on("postgres_changes", { event: "*", schema: "public", table: "facturas" }, () => void cargar()).subscribe();
    return () => { void supabase().removeChannel(canal); };
  }, [cargar]);

  useEffect(() => {
    if (params.get("nueva") === "1") setEditor("nueva");
  }, [params]);

  const visibles = useMemo(() => {
    const hoy = hoySantiago();
    const d = filtroDesde || "2000-01-01";
    const h = filtroHasta || hoy;
    return filas.filter((fila) => fila.fecha_ingreso >= d && fila.fecha_ingreso <= h);
  }, [filas, filtroDesde, filtroHasta]);

  useEffect(() => {
    if (visibles.length === 0) {
      setElegida("");
      setIndice(0);
      return;
    }
    const pos = visibles.findIndex((fila) => fila.id === elegida);
    if (pos < 0) {
      setElegida(visibles[0].id);
      setIndice(0);
    } else {
      setIndice(pos);
    }
  }, [visibles, elegida]);

  function aplicarFiltro() {
    setFiltroDesde(desde);
    setFiltroHasta(hasta);
  }

  function limpiarFiltro() {
    setDesde("");
    setHasta("");
    setFiltroDesde("");
    setFiltroHasta("");
  }

  function ir(pos: number) {
    if (pos < 0 || pos >= visibles.length) return;
    setIndice(pos);
    setElegida(visibles[pos].id);
  }

  function abrirModificar() {
    if (!elegida) {
      setAviso("Seleccione una factura de la lista.");
      return;
    }
    setEditor(elegida);
  }

  return (
    <div className="facturas-panel">
      <div className="facturas-panel-marco">
        <div className="facturas-panel-cuerpo">
          <div className="tabla-scroll escritorio-solo facturas-tabla-caja">
            <table className="tabla facturas-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>N° factura</th>
                  <th className="text-right">Neto</th>
                  <th className="text-right">IVA</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Saldo pend.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr><td colSpan={8} className="text-[#6b7289]">No hay facturas en este rango.</td></tr>
                )}
                {visibles.map((fila) => (
                  <tr
                    key={fila.id}
                    className={elegida === fila.id ? "elegida" : ""}
                    onClick={() => { setElegida(fila.id); setIndice(visibles.findIndex((item) => item.id === fila.id)); }}
                    onDoubleClick={() => setEditor(fila.id)}
                  >
                    <td className="nowrap">{fechaCorta(fila.fecha_ingreso)}</td>
                    <td>{fila.proveedor}</td>
                    <td><button type="button" className="enlace-factura" onClick={() => setEditor(fila.id)}>{fila.numero}</button></td>
                    <td className="text-right nowrap">{formatoPeso(fila.neto_calculado)}</td>
                    <td className="text-right nowrap">{formatoPeso(fila.iva_calculado)}</td>
                    <td className="text-right nowrap">{formatoPeso(fila.total_oficial)}</td>
                    <td className={`text-right nowrap ${fila.saldo > 0 ? "saldo-rojo" : ""}`}>{formatoPeso(fila.saldo)}</td>
                    <td><EstadoBadge estado={fila.estado} conRapel={Boolean(fila.con_rapel)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lista-cartas movil-solo facturas-cartas">
            {visibles.length === 0 && <p className="pendientes-vacio">No hay facturas en este rango.</p>}
            {visibles.map((fila) => (
              <button
                key={fila.id}
                type="button"
                className={`carta-factura ${elegida === fila.id ? "elegida" : ""}`}
                onClick={() => { setElegida(fila.id); setIndice(visibles.findIndex((item) => item.id === fila.id)); }}
                onDoubleClick={() => setEditor(fila.id)}
              >
                <div className="carta-factura-arriba">
                  <span className="carta-factura-numero">{fila.numero}</span>
                  <EstadoBadge estado={fila.estado} conRapel={Boolean(fila.con_rapel)} />
                </div>
                <p className="factura-linea-meta">{fila.proveedor} · {fechaCorta(fila.fecha_ingreso)}</p>
                <div className="carta-factura-abajo">
                  <span>Total {formatoPeso(fila.total_oficial)}</span>
                  <strong className={fila.saldo > 0 ? "saldo-rojo" : ""}>{formatoPeso(fila.saldo)}</strong>
                </div>
              </button>
            ))}
          </div>
        </div>

        <footer className="facturas-barra">
          <div className="facturas-barra-izq">
            <div className="facturas-barra-acciones">
              <button type="button" className="btn-barra btn-barra-principal" onClick={() => setEditor("nueva")}>Agregar nueva factura</button>
              <button type="button" className="btn-barra" onClick={abrirModificar}>Modificar</button>
              <button type="button" className="btn-barra" onClick={() => void cargar()}>Actualizar</button>
              <Link className="btn-barra" href="/">Salir</Link>
            </div>

            <div className="facturas-barra-filtro">
              <label className="campo filtro-fecha">
                <span className="etiqueta">Rango inicial</span>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label className="campo filtro-fecha">
                <span className="etiqueta">Rango final</span>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </label>
              <button type="button" className="btn-barra" onClick={aplicarFiltro}>Filtrar</button>
              <button type="button" className="btn-barra" onClick={limpiarFiltro}>Limpiar</button>
            </div>
          </div>

          <div className="facturas-barra-nav">
            <button type="button" className="btn-barra barra-ico" disabled={indice <= 0} onClick={() => ir(0)} title="Primera">«</button>
            <button type="button" className="btn-barra barra-ico" disabled={indice <= 0} onClick={() => ir(indice - 1)} title="Anterior">‹</button>
            <span className="facturas-registro">Registro {visibles.length === 0 ? 0 : indice + 1} de {visibles.length}</span>
            <button type="button" className="btn-barra barra-ico" disabled={indice >= visibles.length - 1} onClick={() => ir(indice + 1)} title="Siguiente">›</button>
            <button type="button" className="btn-barra barra-ico" disabled={indice >= visibles.length - 1} onClick={() => ir(visibles.length - 1)} title="Última">»</button>
          </div>
        </footer>
        {aviso && <p className="aviso m-0 rounded-none border-x-0 border-b-0">{aviso}</p>}
      </div>

      {editor !== null && (
        <div className="factura-modal-capa" role="dialog" aria-modal="true">
          <div className="factura-modal">
            <EditorFactura
              key={editor === "nueva" ? "nueva" : editor}
              facturaId={editor === "nueva" ? undefined : editor}
              variante="modal"
              onCerrar={() => {
                setEditor(null);
                router.replace("/facturas");
              }}
              onGuardado={() => void cargar()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado, conRapel }: { estado: string; conRapel: boolean }) {
  const texto = estadoVisible(estado, conRapel);
  const clase =
    estado === "anulada" ? "estado-anulado"
      : estado === "pagada" ? "estado-pagado"
        : estado === "pago_parcial" ? "estado-parcial"
          : "estado-pendiente";
  return <span className={`estado-badge ${clase}`}>{texto}</span>;
}

export default function Facturas() {
  return (
    <Suspense fallback={<main className="p-4">Cargando facturas…</main>}>
      <PanelFacturas />
    </Suspense>
  );
}
