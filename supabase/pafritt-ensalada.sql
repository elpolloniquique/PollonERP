-- Proveedor de prueba: PAFRITT ENSALADA
-- Productos: Ensalada personal, Ensalada familiar
-- Facturas reales del listado (28-09-2026 al 01-11-2026)
-- Ejecutar en el SQL Editor de Supabase. Se puede correr de nuevo sin duplicar.

do $$
declare
  emp uuid;
  prov uuid;
  fac uuid;
  fila record;
  neto numeric(18, 4);
  iva numeric(18, 4);
  total_calc numeric(18, 4);
  credito integer := 7;
  prod_codigo text;
  prod_nombre text;
  cargadas integer := 0;
begin
  select id into emp from empresas limit 1;
  if emp is null then
    raise exception 'Primero entre al sistema y cree la empresa.';
  end if;

  -- Si hubiera varios con el mismo nombre, conserva el más antiguo y desactiva el resto.
  select id into prov
  from proveedores
  where empresa_id = emp and lower(nombre) = lower('PAFRITT ENSALADA')
  order by creado_en
  limit 1;

  update proveedores
  set activo = false,
      nombre = 'PAFRITT ENSALADA (duplicado)'
  where empresa_id = emp
    and lower(nombre) = lower('PAFRITT ENSALADA')
    and id is distinct from prov;

  if prov is null then
    insert into proveedores (
      empresa_id, nombre, rut, dias_credito, porcentaje_iva, activo, giro, rubro, razon_social
    ) values (
      emp, 'PAFRITT ENSALADA', '', credito, 19, true, 'Alimentos', 'Ensaladas', 'PAFRITT ENSALADA'
    )
    returning id into prov;
  else
    update proveedores
    set activo = true,
        nombre = 'PAFRITT ENSALADA',
        dias_credito = credito,
        porcentaje_iva = 19,
        giro = coalesce(nullif(giro, ''), 'Alimentos'),
        rubro = coalesce(nullif(rubro, ''), 'Ensaladas')
    where id = prov;
  end if;

  insert into productos (proveedor_id, codigo, nombre, unidad, precio_neto, aplica_iva, activo)
  select prov, v.codigo, v.nombre, v.unidad, v.precio, true, true
  from (values
    ('ENS-PER', 'Ensalada personal', 'Unidad', 2500),
    ('ENS-FAM', 'Ensalada familiar', 'Unidad', 4500)
  ) as v(codigo, nombre, unidad, precio)
  where not exists (
    select 1 from productos p
    where p.proveedor_id = prov and (p.codigo = v.codigo or lower(p.nombre) = lower(v.nombre))
  );

  for fila in
    select *
    from (values
      ('12366', date '2026-09-28', 126140),
      ('12374', date '2026-09-29', 121380),
      ('12378', date '2026-09-30', 142800),
      ('12382', date '2026-10-01', 241570),
      ('12386', date '2026-10-02', 235620),
      ('12390', date '2026-10-03', 328440),
      ('12394', date '2026-10-04', 222530),
      ('12398', date '2026-10-05', 149940),
      ('12402', date '2026-10-06', 178500),
      ('12406', date '2026-10-07', 141610),
      ('12410', date '2026-10-08', 187782),
      ('12414', date '2026-10-09', 280126),
      ('12418', date '2026-10-10', 333200),
      ('12422', date '2026-10-11', 414120),
      ('12426', date '2026-10-12', 198968),
      ('12430', date '2026-10-12', 49980),
      ('12432', date '2026-10-13', 201110),
      ('12436', date '2026-10-14', 149940),
      ('12440', date '2026-10-15', 159460),
      ('12444', date '2026-10-16', 276080),
      ('12448', date '2026-10-17', 326060),
      ('12452', date '2026-10-18', 378420),
      ('12456', date '2026-10-19', 122808),
      ('12460', date '2026-10-20', 199920),
      ('12464', date '2026-10-21', 153272),
      ('12468', date '2026-10-22', 158270),
      ('12472', date '2026-10-23', 281792),
      ('12476', date '2026-10-24', 341054),
      ('12480', date '2026-10-25', 333200),
      ('12484', date '2026-10-26', 176120),
      ('12488', date '2026-10-27', 176120),
      ('12492', date '2026-10-28', 126140),
      ('12496', date '2026-10-29', 176120),
      ('12500', date '2026-10-30', 267750),
      ('12504', date '2026-10-31', 383180),
      ('12508', date '2026-11-01', 390320)
    ) as t(numero, ingreso, total)
  loop
    if exists (select 1 from facturas where proveedor_id = prov and numero = fila.numero) then
      continue;
    end if;

    neto := round(fila.total / 1.19, 4);
    iva := round(neto * 0.19, 4);
    total_calc := neto + iva;

    if (fila.numero::integer % 2) = 0 then
      prod_codigo := 'ENS-FAM';
      prod_nombre := 'Ensalada familiar';
    else
      prod_codigo := 'ENS-PER';
      prod_nombre := 'Ensalada personal';
    end if;

    insert into facturas (
      empresa_id, proveedor_id, numero,
      fecha_ingreso, fecha_emision, fecha_vencimiento,
      porcentaje_iva, neto_calculado, iva_calculado, total_calculado,
      total_oficial, ajuste_redondeo, origen, observaciones
    ) values (
      emp, prov, fila.numero,
      fila.ingreso, fila.ingreso, fila.ingreso + credito,
      19, neto, iva, total_calc,
      fila.total, round(fila.total - total_calc, 4), 'manual', 'Carga de prueba PAFRITT'
    )
    returning id into fac;

    insert into factura_lineas (
      factura_id, orden, codigo, descripcion, unidad, cantidad,
      precio_neto_unitario, descuento_porcentaje, aplica_iva,
      base, neto_linea, iva_linea, total_linea
    ) values (
      fac, 0, prod_codigo, prod_nombre, 'Unidad', 1,
      neto, 0, true,
      neto, neto, iva, total_calc
    );

    cargadas := cargadas + 1;
  end loop;

  raise notice 'PAFRITT ENSALADA listo. Facturas nuevas: %', cargadas;
end $$;
