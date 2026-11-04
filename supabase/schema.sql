-- SG Proveedores. Ejecutar completo en el editor SQL de Supabase.
-- Cada usuario solo ve la empresa de su perfil.

create extension if not exists pgcrypto;

create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre_comercial text not null,
  razon_social text not null default '',
  rut text not null default '',
  giro text not null default '',
  direccion text not null default '',
  telefono text not null default '',
  correo text not null default '',
  tolerancia_pesos numeric(12, 2) not null default 5,
  porcentaje_iva numeric(8, 4) not null default 19,
  creado_en timestamptz not null default now()
);

create table if not exists perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid references empresas (id),
  nombre text not null default '',
  rol text not null default 'operador' check (rol in ('superadmin', 'administrador', 'operador')),
  puede_ver boolean not null default true,
  puede_crear boolean not null default true,
  puede_modificar boolean not null default true,
  puede_eliminar boolean not null default false
);

create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  nombre text not null,
  rubro text not null default '',
  razon_social text not null default '',
  rut text not null default '',
  giro text not null default '',
  contacto text not null default '',
  telefono text not null default '',
  correo_cobranza text not null default '',
  direccion text not null default '',
  dias_credito integer not null default 30 check (dias_credito between 0 and 365),
  observaciones text not null default '',
  activo boolean not null default true,
  banco text not null default '',
  tipo_cuenta text not null default '',
  numero_cuenta text not null default '',
  rapel_activo boolean not null default false,
  porcentaje_iva numeric(8, 4) not null default 19,
  creado_en timestamptz not null default now()
);

create table if not exists impuestos_proveedor (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores (id) on delete cascade,
  nombre text not null,
  porcentaje numeric(8, 4) not null default 0
);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references proveedores (id) on delete cascade,
  codigo text not null default '',
  nombre text not null,
  unidad text not null default 'Unidad',
  aplica_iva boolean not null default true,
  precio_neto numeric(18, 4) not null default 0,
  descuento_porcentaje numeric(8, 4) not null default 0,
  activo boolean not null default true
);

create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  proveedor_id uuid not null references proveedores (id),
  numero text not null,
  fecha_ingreso date not null,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  porcentaje_iva numeric(8, 4) not null,
  neto_calculado numeric(18, 4) not null,
  iva_calculado numeric(18, 4) not null,
  total_calculado numeric(18, 4) not null,
  total_oficial numeric(18, 0) not null,
  ajuste_redondeo numeric(18, 4) not null default 0,
  abonado numeric(18, 0) not null default 0,
  saldo numeric(18, 0) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pago_parcial', 'pagada', 'anulada')),
  origen text not null default 'manual' check (origen in ('manual', 'telegram', 'camara')),
  observaciones text not null default '',
  motivo_anulacion text not null default '',
  creado_en timestamptz not null default now(),
  unique (proveedor_id, numero)
);

create table if not exists factura_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas (id) on delete cascade,
  orden integer not null default 0,
  codigo text not null default '',
  descripcion text not null default '',
  unidad text not null default 'Unidad',
  cantidad numeric(18, 4) not null,
  precio_neto_unitario numeric(18, 4) not null,
  descuento_porcentaje numeric(8, 4) not null default 0,
  aplica_iva boolean not null default true,
  base numeric(18, 4) not null,
  neto_linea numeric(18, 4) not null,
  iva_linea numeric(18, 4) not null,
  total_linea numeric(18, 4) not null
);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  proveedor_id uuid not null references proveedores (id),
  fecha date not null,
  monto numeric(18, 0) not null,
  medio text not null default 'transferencia',
  observacion text not null default '',
  es_abono boolean not null default false,
  creado_en timestamptz not null default now()
);

create table if not exists pago_facturas (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references pagos (id) on delete cascade,
  factura_id uuid not null references facturas (id),
  monto numeric(18, 0) not null
);

create index if not exists facturas_empresa_idx on facturas (empresa_id, estado, fecha_vencimiento);
create index if not exists facturas_proveedor_idx on facturas (proveedor_id, fecha_ingreso);

create or replace function empresa_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from perfiles where id = auth.uid()
$$;

create or replace function tiene(accion text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case accion
    when 'ver' then puede_ver
    when 'crear' then puede_crear
    when 'modificar' then puede_modificar
    when 'eliminar' then puede_eliminar
    else false
  end
  from perfiles
  where id = auth.uid()
$$;

create or replace function cerrar_factura()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado = 'anulada' then
    if tg_op = 'UPDATE' and old.estado is distinct from 'anulada' and not tiene('eliminar') then
      raise exception 'No tiene permiso para anular la factura.';
    end if;
    new.saldo := 0;
    return new;
  end if;
  new.saldo := greatest(new.total_oficial - new.abonado, 0);
  if new.saldo = 0 and new.abonado > 0 then
    new.estado := 'pagada';
  elsif new.abonado > 0 then
    new.estado := 'pago_parcial';
  else
    new.estado := 'pendiente';
  end if;
  return new;
end;
$$;

drop trigger if exists facturas_cerrar on facturas;
create trigger facturas_cerrar
before insert or update on facturas
for each row execute function cerrar_factura();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

create or replace function crear_mi_empresa(p_nombre text, p_rut text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión.';
  end if;
  if exists (select 1 from perfiles where id = auth.uid() and empresa_id is not null) then
    raise exception 'Ya pertenece a una empresa.';
  end if;
  if exists (select 1 from empresas) then
    raise exception 'La empresa ya fue creada. Pida que lo asignen.';
  end if;
  if length(trim(p_nombre)) < 2 then
    raise exception 'Escriba el nombre de la empresa.';
  end if;
  insert into empresas (nombre_comercial, rut)
  values (trim(p_nombre), trim(p_rut))
  returning id into nueva;
  update perfiles
  set empresa_id = nueva,
      rol = 'superadmin',
      puede_ver = true,
      puede_crear = true,
      puede_modificar = true,
      puede_eliminar = true
  where id = auth.uid();
  return nueva;
end;
$$;

alter table empresas enable row level security;
alter table perfiles enable row level security;
alter table proveedores enable row level security;
alter table impuestos_proveedor enable row level security;
alter table productos enable row level security;
alter table facturas enable row level security;
alter table factura_lineas enable row level security;
alter table pagos enable row level security;
alter table pago_facturas enable row level security;

drop policy if exists empresas_sel on empresas;
create policy empresas_sel on empresas for select using (id = empresa_actual());
drop policy if exists empresas_upd on empresas;
create policy empresas_upd on empresas for update
using (id = empresa_actual() and tiene('modificar'))
with check (id = empresa_actual());

create or replace function soy_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'superadmin'
  )
$$;

create or replace function soy_admin_de_empresa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid()
      and rol in ('superadmin', 'administrador')
      and puede_modificar
  )
$$;

drop policy if exists perfiles_sel on perfiles;
create policy perfiles_sel on perfiles for select using (
  id = auth.uid()
  or (empresa_id is not null and empresa_id = empresa_actual())
  or (empresa_id is null and soy_superadmin())
);
drop policy if exists perfiles_upd on perfiles;
create policy perfiles_upd on perfiles for update
using (
  id = auth.uid()
  or (
    soy_admin_de_empresa()
    and (empresa_id is null or empresa_id = empresa_actual())
  )
)
with check (
  id = auth.uid()
  or (
    soy_admin_de_empresa()
    and (empresa_id is null or empresa_id = empresa_actual())
  )
);

drop policy if exists prov_sel on proveedores;
create policy prov_sel on proveedores for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists prov_ins on proveedores;
create policy prov_ins on proveedores for insert with check (empresa_id = empresa_actual() and tiene('crear'));
drop policy if exists prov_upd on proveedores;
create policy prov_upd on proveedores for update using (empresa_id = empresa_actual() and tiene('modificar'));

drop policy if exists imp_sel on impuestos_proveedor;
create policy imp_sel on impuestos_proveedor for select using (
  exists (select 1 from proveedores p where p.id = proveedor_id and p.empresa_id = empresa_actual())
);
drop policy if exists imp_all on impuestos_proveedor;
create policy imp_all on impuestos_proveedor for all using (
  tiene('modificar') and exists (select 1 from proveedores p where p.id = proveedor_id and p.empresa_id = empresa_actual())
) with check (
  tiene('modificar') and exists (select 1 from proveedores p where p.id = proveedor_id and p.empresa_id = empresa_actual())
);

drop policy if exists prod_sel on productos;
create policy prod_sel on productos for select using (
  exists (select 1 from proveedores p where p.id = proveedor_id and p.empresa_id = empresa_actual())
);
drop policy if exists prod_all on productos;
create policy prod_all on productos for all using (
  tiene('modificar') and exists (select 1 from proveedores p where p.id = proveedor_id and p.empresa_id = empresa_actual())
) with check (
  tiene('crear') and exists (select 1 from proveedores p where p.id = proveedor_id and p.empresa_id = empresa_actual())
);

drop policy if exists fac_sel on facturas;
create policy fac_sel on facturas for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists fac_ins on facturas;
create policy fac_ins on facturas for insert with check (empresa_id = empresa_actual() and tiene('crear'));
drop policy if exists fac_upd on facturas;
create policy fac_upd on facturas for update using (empresa_id = empresa_actual() and tiene('modificar'));
drop policy if exists fac_del on facturas;
create policy fac_del on facturas for delete using (empresa_id = empresa_actual() and tiene('modificar'));

drop policy if exists lin_sel on factura_lineas;
create policy lin_sel on factura_lineas for select using (
  exists (select 1 from facturas f where f.id = factura_id and f.empresa_id = empresa_actual())
);
drop policy if exists lin_all on factura_lineas;
create policy lin_all on factura_lineas for all using (
  exists (select 1 from facturas f where f.id = factura_id and f.empresa_id = empresa_actual() and tiene('modificar'))
) with check (
  exists (select 1 from facturas f where f.id = factura_id and f.empresa_id = empresa_actual() and tiene('crear'))
);

drop policy if exists pag_sel on pagos;
create policy pag_sel on pagos for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists pag_ins on pagos;
create policy pag_ins on pagos for insert with check (empresa_id = empresa_actual() and tiene('crear'));

drop policy if exists pf_sel on pago_facturas;
create policy pf_sel on pago_facturas for select using (
  exists (select 1 from pagos p where p.id = pago_id and p.empresa_id = empresa_actual())
);
drop policy if exists pf_ins on pago_facturas;
create policy pf_ins on pago_facturas for insert with check (
  exists (select 1 from pagos p where p.id = pago_id and p.empresa_id = empresa_actual() and tiene('crear'))
);

alter table facturas replica identity full;
alter table pagos replica identity full;

do $$
begin
  alter publication supabase_realtime add table facturas;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table pagos;
exception when duplicate_object then null;
when undefined_object then null;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on empresas, perfiles, proveedores, impuestos_proveedor, productos, facturas, factura_lineas, pagos, pago_facturas to authenticated;
grant execute on function crear_mi_empresa(text, text) to authenticated;
grant execute on function empresa_actual() to anon, authenticated;
grant execute on function tiene(text) to anon, authenticated;
grant execute on function soy_superadmin() to anon, authenticated;
grant execute on function soy_admin_de_empresa() to anon, authenticated;
