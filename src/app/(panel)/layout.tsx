"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizarRut } from "@/lib/rut";
import { Empresa, Perfil, supabase } from "@/lib/supabase";

type Enlace = { href: string; texto: string; grupo: string };

export default function Panel({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: usuario } = await supabase().auth.getUser();
      if (!usuario.user) return;
      const { data, error: fallo } = await supabase().from("perfiles").select("*").eq("id", usuario.user.id).single();
      if (!vivo) return;
      if (fallo || !data) {
        setError("No hay perfil. Ejecute supabase/schema.sql en el proyecto.");
        return;
      }
      const actual = data as Perfil;
      setPerfil(actual);
      if (!actual.empresa_id) return;
      const empresaCargada = await supabase().from("empresas").select("*").eq("id", actual.empresa_id).single();
      if (vivo && empresaCargada.data) setEmpresa(empresaCargada.data as Empresa);
    })();
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    setAbierto(false);
  }, [ruta]);

  if (error) return <main className="p-6"><p className="error">{error}</p></main>;
  if (!perfil) return <main className="p-6">Cargando sesión…</main>;
  if (!perfil.empresa_id || !empresa) return <AltaEmpresa nombre={perfil.nombre} />;

  const admin = perfil.rol === "superadmin" || perfil.rol === "administrador";
  const enlaces: Enlace[] = [
    { href: "/", texto: "Inicio", grupo: "Principal" },
    { href: "/proveedores", texto: "Proveedores", grupo: "Operación" },
    { href: "/facturas/nueva", texto: "Factura", grupo: "Operación" },
    { href: "/facturas/pendientes", texto: "Pendientes", grupo: "Operación" },
    { href: "/fotos", texto: "Fotos", grupo: "Operación" },
    { href: "/pagos/registrar", texto: "Registrar pago", grupo: "Pagos" },
    { href: "/pagos/abono", texto: "Abono parcial", grupo: "Pagos" },
    { href: "/facturas/parciales", texto: "Pago parcial", grupo: "Pagos" },
    { href: "/rapel", texto: "Rapel", grupo: "Pagos" },
    { href: "/facturas/listado", texto: "Listado", grupo: "Reportes" },
    { href: "/reportes/productos", texto: "Productos", grupo: "Reportes" },
    { href: "/personal", texto: "Personal", grupo: "Empresa" },
    ...(admin ? [{ href: "/usuarios", texto: "Usuarios", grupo: "Empresa" }] : []),
  ];
  const grupos = [...new Set(enlaces.map((item) => item.grupo))];
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`));
  const tituloActual = enlaces.find((item) => activo(item.href))?.texto ?? "Panel";

  function cerrarSesion() {
    void supabase().auth.signOut().then(() => {
      window.location.href = "/login";
    });
  }

  const menu = (
    <>
      <div className="menu-marca">
        <span className="menu-marca-punto" aria-hidden />
        <div>
          <p className="menu-marca-nombre">{empresa.nombre_comercial}</p>
          <p className="menu-marca-rol">{perfil.nombre}</p>
        </div>
      </div>

      <nav className="menu-nav">
        {grupos.map((grupo) => (
          <div key={grupo} className="menu-grupo">
            <p className="menu-grupo-titulo">{grupo}</p>
            {enlaces.filter((item) => item.grupo === grupo).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`menu-enlace ${activo(item.href) ? "menu-enlace-activo" : ""}`}
              >
                <span className="menu-enlace-barra" aria-hidden />
                {item.texto}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="menu-pie">
        <button type="button" className="menu-salir" onClick={cerrarSesion}>
          Salir
        </button>
      </div>
    </>
  );

  return (
    <div className="shell">
      <aside className="menu-escritorio" aria-label="Menú principal">
        {menu}
      </aside>

      <div className={`menu-capa ${abierto ? "menu-capa-visible" : ""}`} onClick={() => setAbierto(false)} aria-hidden={!abierto} />
      <aside className={`menu-movil ${abierto ? "menu-movil-abierto" : ""}`} aria-label="Menú móvil" aria-hidden={!abierto}>
        <div className="menu-movil-cabeza">
          <span>Menú</span>
          <button type="button" className="menu-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar menú">
            ×
          </button>
        </div>
        {menu}
      </aside>

      <div className="shell-contenido">
        <header className="shell-barra">
          <button type="button" className="menu-abrir" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <span />
            <span />
            <span />
          </button>
          <div className="shell-barra-texto">
            <p className="shell-barra-titulo">{tituloActual}</p>
            <p className="shell-barra-sub">{empresa.nombre_comercial}</p>
          </div>
        </header>
        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}

function AltaEmpresa({ nombre }: { nombre: string }) {
  const [comercial, setComercial] = useState("");
  const [rut, setRut] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function crear() {
    setError("");
    const normal = normalizarRut(rut);
    if ("error" in normal) {
      setError(normal.error);
      return;
    }
    setOcupado(true);
    const { error: fallo } = await supabase().rpc("crear_mi_empresa", { p_nombre: comercial, p_rut: normal.guardado });
    setOcupado(false);
    if (fallo) {
      setError(fallo.message);
      return;
    }
    window.location.reload();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <section className="marco w-[420px] max-w-full">
        <h1 className="titulo-barra">Empresa</h1>
        <div className="space-y-3 p-4">
          <p>{nombre}, esta cuenta todavía no tiene empresa. La primera cuenta crea la empresa y queda como super administrador.</p>
          <label className="campo">
            <span className="etiqueta">Nombre comercial</span>
            <input value={comercial} onChange={(e) => setComercial(e.target.value)} />
          </label>
          <label className="campo">
            <span className="etiqueta">RUT</span>
            <input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="76.097.744-6" />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-solido" disabled={ocupado || comercial.trim().length < 2} onClick={crear}>
            Crear empresa
          </button>
        </div>
      </section>
    </main>
  );
}
