"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizarRut } from "@/lib/rut";
import { Empresa, Perfil, supabase } from "@/lib/supabase";

type Enlace = { href: string; texto: string; grupo: string };

function IconoMenu({ href }: { href: string }) {
  const comun = {
    viewBox: "0 0 24 24",
    width: 16,
    height: 16,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (href === "/") {
    return (
      <svg {...comun}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6.5 9.8V20h11V9.8" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }
  if (href === "/proveedores") {
    return (
      <svg {...comun}>
        <path d="M4 20V6.5L12 3l8 3.5V20" />
        <path d="M9 20v-4h6v4" />
        <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
      </svg>
    );
  }
  if (href === "/facturas") {
    return (
      <svg {...comun}>
        <path d="M7 3.5h7l4 4V20.5H7z" />
        <path d="M14 3.5V8h4" />
        <path d="M9.5 12h5M9.5 15.5h5" />
      </svg>
    );
  }
  if (href === "/facturas/pendientes") {
    return (
      <svg {...comun}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4.5l3 2" />
      </svg>
    );
  }
  if (href === "/fotos") {
    return (
      <svg {...comun}>
        <path d="M4.5 8.5h3l1.2-2h6.6l1.2 2h3V19H4.5z" />
        <circle cx="12" cy="13.2" r="3" />
      </svg>
    );
  }
  if (href === "/pagos/registrar") {
    return (
      <svg {...comun}>
        <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
        <path d="M3.5 10h17" />
        <path d="M7 14.5h4" />
      </svg>
    );
  }
  if (href === "/pagos/abono") {
    return (
      <svg {...comun}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8.5v7M9.2 10.2c.6-.8 1.6-1.2 2.8-1.2 1.6 0 2.7.8 2.7 2s-1.1 1.8-2.7 1.8h-.8c-1.6 0-2.7.8-2.7 2s1.1 2 2.7 2c1.2 0 2.2-.4 2.8-1.2" />
      </svg>
    );
  }
  if (href === "/facturas/parciales") {
    return (
      <svg {...comun}>
        <path d="M12 4a8 8 0 1 0 8 8h-8z" />
        <path d="M12 4v8h8" />
      </svg>
    );
  }
  if (href === "/rapel") {
    return (
      <svg {...comun}>
        <path d="M4.5 8.5h9.2a3.3 3.3 0 0 1 0 6.6H8" />
        <path d="M7.2 6.2 4.5 8.5l2.7 2.3" />
        <path d="M19.5 15.5H10.3a3.3 3.3 0 0 1 0-6.6H16" />
        <path d="M16.8 17.8 19.5 15.5l-2.7-2.3" />
      </svg>
    );
  }
  if (href === "/personal") {
    return (
      <svg {...comun}>
        <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
        <circle cx="12" cy="10" r="2.2" />
        <path d="M8.2 16.2c.7-1.5 2-2.2 3.8-2.2s3.1.7 3.8 2.2" />
      </svg>
    );
  }
  if (href === "/usuarios") {
    return (
      <svg {...comun}>
        <circle cx="9" cy="9" r="2.4" />
        <path d="M4.8 17.2c.6-2 2.2-3 4.2-3s3.6 1 4.2 3" />
        <circle cx="16.2" cy="9.4" r="2" />
        <path d="M15.2 14.4c1.4.2 2.5 1 3.2 2.8" />
      </svg>
    );
  }
  return (
    <svg {...comun}>
      <path d="M10 7V4.5H5.5V19.5H10V17" />
      <path d="M10 12h9" />
      <path d="M16 8.5 19.5 12 16 15.5" />
    </svg>
  );
}

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
    { href: "/facturas", texto: "Factura", grupo: "Operación" },
    { href: "/facturas/pendientes", texto: "Pendientes", grupo: "Operación" },
    { href: "/fotos", texto: "Fotos", grupo: "Operación" },
    { href: "/pagos/registrar", texto: "Registrar pago", grupo: "Pagos" },
    { href: "/pagos/abono", texto: "Abono parcial", grupo: "Pagos" },
    { href: "/facturas/parciales", texto: "Pago parcial", grupo: "Pagos" },
    { href: "/rapel", texto: "Rapel", grupo: "Pagos" },
    { href: "/personal", texto: "Personal", grupo: "Empresa" },
    ...(admin ? [{ href: "/usuarios", texto: "Usuarios", grupo: "Empresa" }] : []),
  ];
  const grupos = [...new Set(enlaces.map((item) => item.grupo))];
  const activo = (href: string) => {
    if (href === "/") return ruta === "/";
    if (href === "/facturas") return ruta === "/facturas" || ruta === "/facturas/nueva" || /^\/facturas\/[0-9a-f-]{36}$/i.test(ruta);
    return ruta === href || ruta.startsWith(`${href}/`);
  };
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
                <span className="menu-icono"><IconoMenu href={item.href} /></span>
                {item.texto}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="menu-pie">
        <button type="button" className="menu-salir" onClick={cerrarSesion}>
          <span className="menu-icono"><IconoMenu href="/salir" /></span>
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
