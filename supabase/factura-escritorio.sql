-- Carga de prueba, sin tabla temporal. Se puede ejecutar de nuevo:
-- completa los proveedores que todavía no tengan 10 facturas.

alter table productos add column if not exists codigo text not null default '';
alter table productos add column if not exists aplica_iva boolean not null default true;
alter table factura_lineas add column if not exists codigo text not null default '';

do $$
declare
  emp uuid;
  prov uuid;
  fila record;
  art record;
  total_arts integer;
  n integer;
  k integer;
  ingreso date;
  cant numeric;
  neto numeric;
  iva_linea numeric;
  neto_f numeric;
  iva_f numeric;
  fac uuid;
  numero_fac text;
  cargadas integer := 0;
begin
  select id into emp from empresas limit 1;
  if emp is null then
    raise exception 'Primero entre al sistema y cree la empresa. Después vuelva a ejecutar este archivo.';
  end if;

  for fila in
    select distinct proveedor, rut, credito, serie
    from (values
      ('Ariztia', '96529310-8', 15, 'ARZ'),
      ('CCU', '99586120-8', 30, 'CCU'),
      ('Soprole', '76000110-4', 30, 'SOP'),
      ('Ideal', '81201000-K', 7, 'IDE'),
      ('PF', '91000001-2', 30, 'PF')
    ) as maestros(proveedor, rut, credito, serie)
  loop
    select id into prov
    from proveedores
    where empresa_id = emp and nombre = fila.proveedor
    limit 1;

    if prov is null then
      insert into proveedores (empresa_id, nombre, rut, dias_credito, porcentaje_iva, activo, giro)
      values (emp, fila.proveedor, fila.rut, fila.credito, 19, true, 'Prueba')
      returning id into prov;
    end if;

    insert into productos (proveedor_id, codigo, nombre, unidad, precio_neto, aplica_iva, activo)
    select prov, v.codigo, v.nombre, v.unidad, v.precio, true, true
    from (values
      ('Ariztia', '0000001', 'Pollo', 'Unidad', 4200),
      ('Ariztia', '0000002', 'Pechuga', 'Kilo', 3990),
      ('Ariztia', '0000003', 'Huevo', 'Caja', 3590),
      ('Ariztia', '0000004', 'Nuggets', 'Kilo', 4490),
      ('Ariztia', '0000010', 'Trutro', 'Unidad', 1890),
      ('Ariztia', '0000011', 'Ala', 'Kilo', 2490),
      ('Ariztia', '0000012', 'Filete', 'Kilo', 5290),
      ('Ariztia', '0000013', 'Menudencia', 'Kilo', 1590),
      ('CCU', '0000001', 'Cerveza', 'Caja', 8900),
      ('CCU', '0000002', 'Bebida', 'Caja', 6400),
      ('CCU', '0000003', 'Agua', 'Paquete', 3200),
      ('CCU', '0000004', 'Néctar', 'Caja', 5100),
      ('Soprole', '0000001', 'Leche', 'Caja', 1250),
      ('Soprole', '0000002', 'Yogurt', 'Caja', 1890),
      ('Soprole', '0000003', 'Queso', 'Kilo', 7990),
      ('Soprole', '0000004', 'Mantequilla', 'Unidad', 2390),
      ('Ideal', '0000001', 'Pan', 'Caja', 2100),
      ('Ideal', '0000002', 'Hallulla', 'Unidad', 1600),
      ('Ideal', '0000003', 'Completo', 'Paquete', 2800),
      ('PF', '0000001', 'Cecina', 'Kilo', 6990),
      ('PF', '0000002', 'Jamón', 'Kilo', 8490),
      ('PF', '0000003', 'Salame', 'Kilo', 9290)
    ) as v(proveedor, codigo, nombre, unidad, precio)
    where v.proveedor = fila.proveedor
      and not exists (
        select 1 from productos p
        where p.proveedor_id = prov and p.codigo = v.codigo
      );

    select count(*) into total_arts from productos where proveedor_id = prov;
    if total_arts = 0 then
      raise exception 'No quedaron productos para %', fila.proveedor;
    end if;

    for n in 1..10 loop
      numero_fac := fila.serie || '-' || lpad(n::text, 4, '0');
      if exists (select 1 from facturas where proveedor_id = prov and numero = numero_fac) then
        continue;
      end if;

      ingreso := date '2026-09-02' + ((n - 1) * 3);
      neto_f := 0;
      iva_f := 0;

      insert into facturas (
        empresa_id, proveedor_id, numero, fecha_ingreso, fecha_emision, fecha_vencimiento,
        porcentaje_iva, neto_calculado, iva_calculado, total_calculado, total_oficial,
        ajuste_redondeo, origen, observaciones
      ) values (
        emp, prov, numero_fac, ingreso, ingreso, ingreso + fila.credito,
        19, 0, 0, 0, 0, 0, 'manual', 'Factura de prueba'
      ) returning id into fac;

      for k in 0..1 loop
        select p.codigo, p.nombre, p.unidad, p.precio_neto
        into art
        from productos p
        where p.proveedor_id = prov
        order by p.codigo
        offset ((n + k) % total_arts) limit 1;

        cant := 2 + ((n + k) % 6);
        neto := round(cant * art.precio_neto, 4);
        iva_linea := round(neto * 0.19, 4);
        neto_f := neto_f + neto;
        iva_f := iva_f + iva_linea;

        insert into factura_lineas (
          factura_id, orden, codigo, descripcion, unidad, cantidad, precio_neto_unitario,
          descuento_porcentaje, aplica_iva, base, neto_linea, iva_linea, total_linea
        ) values (
          fac, k, art.codigo, art.nombre, art.unidad, cant, art.precio_neto,
          0, true, cant * art.precio_neto, neto, iva_linea, neto + iva_linea
        );
      end loop;

      update facturas
      set neto_calculado = neto_f,
          iva_calculado = iva_f,
          total_calculado = neto_f + iva_f,
          total_oficial = round(neto_f + iva_f, 0),
          ajuste_redondeo = round(neto_f + iva_f, 0) - (neto_f + iva_f)
      where id = fac;

      cargadas := cargadas + 1;
    end loop;
  end loop;

  raise notice 'Facturas de prueba creadas en esta pasada: %', cargadas;
end $$;
