export default function Preparar() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center p-6">
      <section className="marco w-full">
        <h1 className="titulo-barra text-base">Conectar Supabase</h1>
        <div className="space-y-3 p-4 leading-6">
          <p>El sistema ya está armado. Falta el proyecto de Supabase, que es la base de datos.</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Cree un proyecto en Supabase.</li>
            <li>En Authentication, deje activo el ingreso con correo y clave.</li>
            <li>En el editor SQL, ejecute el archivo supabase/schema.sql de esta carpeta.</li>
            <li>Copie .env.example a .env.local y pegue la URL y la clave anónima del proyecto.</li>
            <li>Reinicie con npm run dev y cree la cuenta de la jefa. Esa cuenta queda como super administrador y crea la empresa.</li>
          </ol>
          <p>No hay proveedores ni facturas de demostración. El primer dato lo escribe usted.</p>
        </div>
      </section>
    </main>
  );
}
