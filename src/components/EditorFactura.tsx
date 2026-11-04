"use client";

import { useCallback, useEffect, useState } from "react";
import { calcularFactura, redondearPeso } from "@/lib/dinero";
import { fechasDeIngreso, hoySantiago } from "@/lib/fechas";
import { formatoDetalle, formatoEntero, formatoPeso, parseMonto } from "@/lib/formato";
import { Perfil, supabase } from "@/lib/supabase";
import { CapturaLinea, DialogoProducto, ProductoOpcion } from "@/components/DialogoProducto";

type ProveedorOpcion = { id: string; nombre: string; dias_credito: number; porcentaje_iva: number; activo?: boolean };
type Linea = CapturaLinea;

const avisoNueva = "Agregue los productos y pulse Grabar. Al grabar, la factura queda guardada y la lista se limpia.";

export function EditorFactura({ facturaId }: { facturaId?: string }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [tolerancia, setTolerancia] = useState(5);
  const [proveedores, setProveedores] = useState<ProveedorOpcion[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [productos, setProductos] = useState<ProductoOpcion[]>([]);
  const [numero, setNumero] = useState("");
  const [ingreso, setIngreso] = useState(hoySantiago());
  const [emision, setEmision] = useState(hoySantiago());
  const [vencimiento, setVencimiento] = useState(hoySantiago());
  const [porcentajeIva, setPorcentajeIva] = useState(19);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [redondeoTexto, setRedondeoTexto] = useState("0");
  const [redondeoTocado, setRedondeoTocado] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [mostrarObs, setMostrarObs] = useState(false);
  const [dialogo, setDialogo] = useState<"agregar" | "modificar" | null>(null);
  const [pideClave, setPideClave] = useState(false);
  const [clave, setClave] = useState("");
  const [bloqueada, setBloqueada] = useState(false);
  const [puedeCambiar, setPuedeCambiar] = useState(true);
  const [esNueva, setEsNueva] = useState(!facturaId);
  const [idActual, setIdActual] = useState<string | null>(facturaId ?? null);
  const [orden, setOrden] = useState<string[]>([]);
  const [indice, setIndice] = useState(-1);
  const [abonado, setAbonado] = useState(0);
  const [aviso, setAviso] = useState(avisoNueva);
  const [error, setError] = useState("");
  const [sucio, setSucio] = useState(false);
  const [listo, setListo] = useState(!facturaId);
  const [confirmaTolerancia, setConfirmaTolerancia] = useState(false);

  const proveedor = proveedores.find((item) => item.id === proveedorId);
  const puedeEditar = esNueva || !bloqueada;
  const entradas = lineas.map((linea) => ({
    cantidad: linea.cantidad,
    precioNetoUnitario: linea.precioNetoUnitario,
    descuentoPorcentaje: linea.descuentoPorcentaje,
    aplicaIva: linea.aplicaIva,
  }));
  const base = calcularFactura(entradas, porcentajeIva, null, tolerancia);
  const ajusteEscrito = parseMonto(redondeoTexto) ?? 0;
  const ajuste = redondeoTocado ? ajusteEscrito : base.totalEnteroSugerido - base.totalCalculado;
  const oficial = redondearPeso(base.totalCalculado + ajuste);
  const calculo = calcularFactura(entradas, porcentajeIva, oficial, tolerancia);

  const refrescarOrden = useCallback(async (proveedor: string, actual: string | null) => {
    if (!proveedor) {
      setOrden([]);
      setIndice(-1);
      return;
    }
    const { data } = await supabase().from("facturas").select("id, fecha_ingreso").eq("proveedor_id", proveedor).order("fecha_ingreso").order("id");
    const ids = ((data ?? []) as { id: string }[]).map((fila) => fila.id);
    setOrden(ids);
    setIndice(actual ? ids.indexOf(actual) : -1);
  }, []);

  async function mostrar(id: string) {
    const factura = await supabase().from("facturas").select("*").eq("id", id).single();
    const detalle = await supabase().from("factura_lineas").select("*").eq("factura_id", id).order("orden");
    if (!factura.data) {
      setError("La factura no existe.");
      return;
    }
    const guardada = factura.data;
    setIdActual(id);
    setEsNueva(false);
    setProveedorId(guardada.proveedor_id);
    setNumero(guardada.numero);
    setIngreso(guardada.fecha_ingreso);
    setEmision(guardada.fecha_emision);
    setVencimiento(guardada.fecha_vencimiento);
    setPorcentajeIva(Number(guardada.porcentaje_iva));
    setObservaciones(guardada.observaciones ?? "");
    setAbonado(Number(guardada.abonado));
    setPuedeCambiar(Number(guardada.abonado) === 0);
    setBloqueada(true);
    setRedondeoTocado(true);
    setRedondeoTexto(formatoDetalle(Number(guardada.ajuste_redondeo)));
    setLineas(((detalle.data ?? []) as LineaGuardada[]).map((linea) => ({
      productoId: "",
      codigo: linea.codigo || "",
      nombre: linea.descripcion,
      unidad: linea.unidad,
      cantidad: Number(linea.cantidad),
      precioNetoUnitario: Number(linea.precio_neto_unitario),
      descuentoPorcentaje: Number(linea.descuento_porcentaje),
      aplicaIva: linea.aplica_iva,
    })));
    setSeleccion(null);
    setSucio(false);
    setAviso(Number(guardada.abonado) === 0
      ? "Factura guardada. Para agregar o cambiar productos, pulse Modificar e ingrese su clave."
      : "Esta factura tiene pagos. Los productos ya no se pueden cambiar.");
    await refrescarOrden(guardada.proveedor_id, id);
    setListo(true);
  }

  useEffect(() => {
    void (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const perfilCargado = await supabase().from("perfiles").select("*").eq("id", usuario.user.id).single();
      const actual = perfilCargado.data as Perfil | null;
      setPerfil(actual);
      if (!actual?.empresa_id) return;
      const empresa = await supabase().from("empresas").select("tolerancia_pesos").eq("id", actual.empresa_id).single();
      if (empresa.data) setTolerancia(Number(empresa.data.tolerancia_pesos));
      const lista = await supabase().from("proveedores").select("id, nombre, dias_credito, porcentaje_iva, activo").eq("empresa_id", actual.empresa_id).order("nombre");
      const filas = (lista.data ?? []) as ProveedorOpcion[];
      setProveedores(filas);
      if (facturaId) {
        await mostrar(facturaId);
        return;
      }
      const hoy = hoySantiago();
      setIngreso(hoy);
      setEmision(hoy);
      setVencimiento(hoy);
      setListo(true);
    })();
    // La carga inicial usa el id de la ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturaId]);

  useEffect(() => {
    if (!proveedorId) return;
    void supabase()
      .from("productos")
      .select("id, codigo, nombre, unidad, precio_neto, descuento_porcentaje, aplica_iva")
      .eq("proveedor_id", proveedorId)
      .eq("activo", true)
      .order("codigo")
      .then(({ data, error: fallo }) => {
        if (fallo) {
          setError("Falta preparar los productos. En Supabase ejecute supabase/factura-escritorio.sql y vuelva a cargar.");
          return;
        }
        setProductos((data ?? []) as ProductoOpcion[]);
      });
  }, [proveedorId]);

  function aplicarProveedor(id: string) {
    if (!esNueva) return;
    const elegido = proveedores.find((item) => item.id === id);
    setProveedorId(id);
    setLineas([]);
    setSeleccion(null);
    setPorcentajeIva(Number(elegido?.porcentaje_iva ?? 19));
    const fechas = fechasDeIngreso(ingreso, elegido?.dias_credito ?? 0);
    setEmision(fechas.emision);
    setVencimiento(fechas.vencimiento);
    setRedondeoTocado(false);
    void refrescarOrden(id, null);
  }

  function aplicarIngreso(valor: string) {
    setIngreso(valor);
    setSucio(true);
    if (!puedeEditar) return;
    const fechas = fechasDeIngreso(valor, proveedor?.dias_credito ?? 0);
    setEmision(fechas.emision);
    setVencimiento(fechas.vencimiento);
  }

  function salirSinGrabar() {
    if (!sucio) return true;
    return window.confirm("Esta factura todavía no está grabada. ¿Continúa sin grabar?");
  }

  async function mover(destino: number, desdeNueva: boolean) {
    if (destino < 0 || destino >= orden.length) return;
    if (!desdeNueva && indice < 0) return;
    if (!salirSinGrabar()) return;
    await mostrar(orden[destino]);
  }

  async function desbloquear() {
    const { data: usuario } = await supabase().auth.getUser();
    const correo = usuario.user?.email;
    if (!correo) return;
    const { error: fallo } = await supabase().auth.signInWithPassword({ email: correo, password: clave });
    if (fallo) {
      setError("La clave no coincide. No se puede modificar la factura.");
      return;
    }
    setClave("");
    setPideClave(false);
    if (!puedeCambiar || abonado > 0) {
      setError("Esta factura tiene pagos. Los productos ya no se pueden cambiar.");
      return;
    }
    setBloqueada(false);
    setAviso("Clave aceptada. Puede agregar o modificar productos y volver a pulsar Grabar.");
    if (seleccion !== null) setDialogo("modificar");
  }

  function modificar() {
    if (bloqueada && !esNueva) {
      setPideClave(true);
      return;
    }
    if (seleccion === null) {
      setError("Seleccione un producto del detalle.");
      return;
    }
    setError("");
    setDialogo("modificar");
  }

  function agregarCaptura(captura: CapturaLinea) {
    if (dialogo === "modificar" && seleccion !== null) {
      setLineas(lineas.map((linea, i) => i === seleccion ? captura : linea));
    } else {
      setLineas([...lineas, captura]);
      setSeleccion(lineas.length);
    }
    setSucio(true);
    setRedondeoTocado(false);
    setAviso(idActual
      ? "El producto quedó en el detalle. Pulse Grabar para actualizar esta factura."
      : "El producto quedó en el detalle. Puede agregar otro y, al terminar, pulse Grabar.");
  }

  function limpiarOtra() {
    const hoy = hoySantiago();
    const fechas = fechasDeIngreso(hoy, proveedor?.dias_credito ?? 0);
    setEsNueva(true);
    setIdActual(null);
    setIndice(-1);
    setBloqueada(false);
    setPuedeCambiar(true);
    setNumero("");
    setObservaciones("");
    setIngreso(hoy);
    setEmision(fechas.emision);
    setVencimiento(fechas.vencimiento);
    setLineas([]);
    setSeleccion(null);
    setRedondeoTocado(false);
    setRedondeoTexto("0");
    setAbonado(0);
    setSucio(false);
    setAviso(avisoNueva);
    setConfirmaTolerancia(false);
    void refrescarOrden(proveedorId, null);
  }

  async function leerFoto(archivo: File) {
    if (!perfil?.empresa_id) return;
    const ruta = `${perfil.empresa_id}/${crypto.randomUUID()}.jpg`;
    await supabase().storage.from("facturas-fotos").upload(ruta, archivo);
    const datos = new FormData();
    datos.append("foto", archivo);
    const respuesta = await fetch("/api/ocr", { method: "POST", body: datos });
    const lectura = await respuesta.json();
    if (lectura.numero) setNumero(lectura.numero);
    if (lectura.fecha) aplicarIngreso(lectura.fecha);
    setAviso(lectura.resumen ?? "No se pudo leer la foto. Revise el archivo.");
    setSucio(true);
    await supabase().from("fotos_factura").insert({
      empresa_id: perfil.empresa_id, ruta, origen: "camara", estado: "borrador",
      rut_leido: lectura.rut ?? "", numero: lectura.numero ?? "", fecha: lectura.fecha || null,
      neto: lectura.neto ?? 0, iva: lectura.iva ?? 0, total: lectura.total ?? 0, cierra: Boolean(lectura.cierra), resumen: lectura.resumen ?? "",
    });
  }

  async function grabar() {
    if (!perfil?.empresa_id || !proveedor) {
      setError("Elija un proveedor.");
      return;
    }
    if (!numero.trim()) {
      setError("Ingrese el número de factura.");
      return;
    }
    if (lineas.length === 0 && (esNueva || !bloqueada)) {
      setError("Agregue al menos un producto.");
      return;
    }
    if (!calculo.dentroDeTolerancia && (esNueva || !bloqueada)) {
      const admin = perfil.rol === "superadmin" || perfil.rol === "administrador";
      if (!admin) {
        setError("La diferencia supera la tolerancia. Ajuste el redondeo.");
        return;
      }
      if (!confirmaTolerancia) {
        setError("La diferencia supera la tolerancia. Confirme el total para grabar.");
        return;
      }
    }
    setError("");
    const cuerpo = {
      empresa_id: perfil.empresa_id,
      proveedor_id: proveedor.id,
      numero: numero.trim(),
      fecha_ingreso: ingreso,
      fecha_emision: emision,
      fecha_vencimiento: vencimiento,
      porcentaje_iva: porcentajeIva,
      neto_calculado: calculo.netoCalculado,
      iva_calculado: calculo.ivaCalculado,
      total_calculado: calculo.totalCalculado,
      total_oficial: calculo.totalOficial,
      ajuste_redondeo: calculo.ajusteRedondeo,
      observaciones,
    };
    if (!esNueva && bloqueada && idActual) {
      const menor = await supabase().from("facturas").update({ observaciones }).eq("id", idActual);
      if (menor.error) { setError(menor.error.message); return; }
      setSucio(false);
      setAviso("Observaciones guardadas.");
      return;
    }
    const consulta = idActual
      ? supabase().from("facturas").update(cuerpo).eq("id", idActual).select("id").single()
      : supabase().from("facturas").insert({ ...cuerpo, origen: "manual" }).select("id").single();
    const { data, error: fallo } = await consulta;
    if (fallo || !data) { setError(fallo?.message ?? "No se guardó."); return; }
    if (idActual) await supabase().from("factura_lineas").delete().eq("factura_id", data.id);
    const filas = calculo.lineas.map((linea, ordenLinea) => ({
      factura_id: data.id,
      orden: ordenLinea,
      codigo: lineas[ordenLinea].codigo,
      descripcion: lineas[ordenLinea].nombre,
      unidad: lineas[ordenLinea].unidad,
      cantidad: linea.cantidad,
      precio_neto_unitario: linea.precioNetoUnitario,
      descuento_porcentaje: linea.descuentoPorcentaje,
      aplica_iva: linea.aplicaIva,
      base: linea.base,
      neto_linea: linea.netoLinea,
      iva_linea: linea.ivaLinea,
      total_linea: linea.totalLinea,
    }));
    const guardadas = await supabase().from("factura_lineas").insert(filas);
    if (guardadas.error) {
      if (!idActual) await supabase().from("facturas").delete().eq("id", data.id);
      setError(guardadas.error.message);
      return;
    }
    setSucio(false);
    limpiarOtra();
    setAviso("Factura grabada. Quedó guardada y la lista se limpió para ingresar otra. Para cambiarla, búsquela y pulse Modificar con su clave.");
  }

  const posicion = indice >= 0
    ? `Registro ${indice + 1} de ${orden.length}`
    : orden.length > 0
      ? `Factura nueva · ${orden.length} guardadas. Pulse « para ver la primera`
      : "Factura nueva";
  const redondeoVisible = redondeoTocado ? redondeoTexto : formatoDetalle(base.totalEnteroSugerido - base.totalCalculado);

  if (!listo) return <main className="p-4">Cargando factura…</main>;

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <section className="marco flex min-h-0 flex-1 flex-col">
        <h1 className="titulo-barra text-center">{esNueva ? "Nueva factura" : `Factura ${numero}`}</h1>
        {esNueva && (
          <label className="btn m-3 inline-flex w-fit cursor-pointer">
            Sacar o elegir foto
            <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => { const archivo = e.target.files?.[0]; if (archivo) void leerFoto(archivo); }} />
          </label>
        )}
        <div className="grid gap-3 border-b border-[#d5e4e1] p-3 md:grid-cols-[180px_140px_1fr_1fr_1fr]">
          <label className="campo"><span className="etiqueta">Proveedor</span>
            <select disabled={!esNueva} value={proveedorId} onChange={(e) => aplicarProveedor(e.target.value)}>
              <option value="">Seleccione</option>
              {proveedores.filter((item) => item.activo !== false || item.id === proveedorId).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label className="campo"><span className="etiqueta">Número de factura</span>
            <input disabled={!puedeEditar} value={numero} onChange={(e) => { setNumero(e.target.value); setSucio(true); }} />
          </label>
          <label className="campo"><span className="etiqueta">Fecha de ingreso</span>
            <input disabled={!puedeEditar} type="date" value={ingreso} onChange={(e) => aplicarIngreso(e.target.value)} />
          </label>
          <label className="campo"><span className="etiqueta">Fecha de emisión</span>
            <input disabled type="date" value={emision} />
          </label>
          <label className="campo"><span className="etiqueta">Fecha de vencimiento</span>
            <input disabled type="date" value={vencimiento} title="Se calcula con los días de crédito del proveedor" />
          </label>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-[#2436F0] py-1.5 text-center font-semibold text-white">Detalle del documento</div>
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <table className="tabla tabla-detalle">
              <thead>
                <tr>
                  <th>Código</th><th>Artículo</th><th>IVA</th><th>Unidad Kardex</th><th>Cantidad</th><th>Precio</th><th>Precio total</th>
                </tr>
              </thead>
              <tbody>
                {calculo.lineas.map((linea, i) => (
                  <tr key={`${lineas[i].codigo}-${i}`} className={seleccion === i ? "elegida" : ""} onClick={() => setSeleccion(i)} onDoubleClick={() => { setSeleccion(i); if (puedeEditar) setDialogo("modificar"); }}>
                    <td>{lineas[i].codigo}</td>
                    <td>{lineas[i].nombre}</td>
                    <td>{formatoEntero(linea.ivaLinea)}</td>
                    <td>{lineas[i].unidad}</td>
                    <td>{formatoDetalle(linea.cantidad)}</td>
                    <td>{formatoEntero(linea.precioNetoUnitario)}</td>
                    <td>{formatoEntero(linea.totalLinea)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[#d5e4e1] px-3 py-1 text-[#2436F0]">{aviso}</p>
        </div>
        <div className="grid items-end gap-3 border-y border-[#d5e4e1] bg-white px-3 py-2 md:grid-cols-[150px_160px_180px_1fr]">
          <Total etiqueta="SUBTOTAL" valor={formatoEntero(calculo.netoCalculado)} />
          <Total etiqueta="IVA" valor={formatoEntero(calculo.ivaCalculado)} />
          <div className="text-center">
            <p className="text-[11px] text-[#5E6E6C]">REDONDEO</p>
            <div className="mt-1 flex items-center justify-center gap-1">
              <button className="btn h-[22px] w-[22px] px-0" disabled={!puedeEditar} onClick={() => { setRedondeoTocado(true); setRedondeoTexto(formatoDetalle(ajuste - 1)); setSucio(true); }}>−</button>
              <input className="w-16 text-center" disabled={!puedeEditar} value={redondeoVisible} onChange={(e) => { setRedondeoTocado(true); setRedondeoTexto(e.target.value); setSucio(true); setConfirmaTolerancia(false); }} />
              <button className="btn h-[22px] w-[22px] px-0" disabled={!puedeEditar} onClick={() => { setRedondeoTocado(true); setRedondeoTexto(formatoDetalle(ajuste + 1)); setSucio(true); }}>+</button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold">TOTAL</p>
            <p className="border-b border-[#1A1A1A] text-base font-bold">{formatoPeso(calculo.totalOficial)}</p>
          </div>
        </div>
        {!calculo.dentroDeTolerancia && puedeEditar && (perfil?.rol === "administrador" || perfil?.rol === "superadmin") && (
          <label className="flex items-center justify-end gap-2 px-3 pt-2"><input className="w-auto" type="checkbox" checked={confirmaTolerancia} onChange={(e) => setConfirmaTolerancia(e.target.checked)} />Confirmo este total fuera de tolerancia</label>
        )}
        {error && <p className="error mx-3 mt-2">{error}</p>}
        <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-6">
          <button className="btn" disabled={!puedeEditar} onClick={() => { if (!proveedorId) { setError("Elija primero el proveedor."); return; } if (productos.length === 0) { setError("Este proveedor no tiene productos activos."); return; } setError(""); setDialogo("agregar"); }}>Agregar</button>
          <button className="btn btn-solido" onClick={() => void grabar()}>Grabar</button>
          <button className="btn" onClick={modificar}>Modificar</button>
          <button className="btn btn-peligro" disabled={!puedeEditar} onClick={() => { if (seleccion === null) { setError("Seleccione un producto del detalle."); return; } setLineas(lineas.filter((_, i) => i !== seleccion)); setSeleccion(null); setSucio(true); setRedondeoTocado(false); }}>Eliminar</button>
          <button className="btn" onClick={() => setMostrarObs(true)}>Observaciones</button>
          <button className="btn" onClick={() => { if (salirSinGrabar()) limpiarOtra(); }}>Agregar nueva factura</button>
        </div>
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-2 border-t border-[#d5e4e1] px-3 py-2">
          <button className="btn min-w-12" disabled={!(orden.length > 0 && indice !== 0)} onClick={() => void mover(0, true)}>«</button>
          <button className="btn min-w-12" disabled={!(orden.length > 0 && indice !== 0)} onClick={() => void mover(indice < 0 ? orden.length - 1 : indice - 1, indice < 0)}>‹</button>
          <p className="text-center font-semibold">{posicion}</p>
          <button className="btn min-w-12" disabled={!(indice >= 0 && indice < orden.length - 1)} onClick={() => void mover(indice + 1, false)}>›</button>
          <button className="btn min-w-12" disabled={!(orden.length > 0 && indice !== orden.length - 1)} onClick={() => void mover(orden.length - 1, true)}>»</button>
        </div>
      </section>
      {dialogo && (
        <DialogoProducto
          productos={productos}
          porcentajeIva={porcentajeIva}
          actual={dialogo === "modificar" && seleccion !== null ? lineas[seleccion] : null}
          onAgregar={agregarCaptura}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {mostrarObs && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#10211f]/35 p-4">
          <section className="marco w-[420px] max-w-full">
            <h2 className="titulo-barra">Observaciones</h2>
            <div className="space-y-3 p-3">
              <textarea rows={4} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button className="btn" onClick={() => setMostrarObs(false)}>Cancelar</button>
                <button className="btn btn-solido" onClick={() => { setSucio(true); setMostrarObs(false); }}>Aceptar</button>
              </div>
            </div>
          </section>
        </div>
      )}
      {pideClave && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#10211f]/35 p-4">
          <section className="marco w-[360px] max-w-full">
            <h2 className="titulo-barra">Confirmar con su clave</h2>
            <div className="space-y-3 p-3">
              <p>Para modificar esta factura, escriba su clave.</p>
              <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} />
              <div className="flex justify-end gap-2">
                <button className="btn" onClick={() => setPideClave(false)}>Cancelar</button>
                <button className="btn btn-solido" onClick={() => void desbloquear()}>Aceptar</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Total({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="text-center">
      <p className="text-[11px] text-[#5E6E6C]">{etiqueta}</p>
      <p className="border-b border-[#1A1A1A] font-semibold">$ {valor}</p>
    </div>
  );
}

type LineaGuardada = {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precio_neto_unitario: number;
  descuento_porcentaje: number;
  aplica_iva: boolean;
};
