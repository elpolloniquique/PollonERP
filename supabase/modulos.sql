-- Pagos, rapel, fotos, personal y remuneraciones.
-- Ejecutar una vez en el SQL Editor.

alter table facturas add column if not exists reservada_rapel boolean not null default false;
alter table facturas add column if not exists con_rapel boolean not null default false;

create table if not exists rapeles (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  proveedor_id uuid not null references proveedores (id),
  fecha date not null,
  monto numeric(18, 0) not null,
  saldo numeric(18, 0) not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'aplicado', 'anulado')),
  creado_en timestamptz not null default now()
);

create table if not exists rapel_facturas (
  id uuid primary key default gen_random_uuid(),
  rapel_id uuid not null references rapeles (id) on delete cascade,
  factura_id uuid not null references facturas (id),
  saldo numeric(18, 0) not null,
  cubierto numeric(18, 0) not null,
  paga_duena numeric(18, 0) not null
);

create table if not exists fotos_factura (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  ruta text not null,
  origen text not null check (origen in ('telegram', 'camara')),
  estado text not null default 'borrador' check (estado in ('borrador', 'confirmada', 'sin_proveedor')),
  proveedor_id uuid references proveedores (id),
  rut_leido text not null default '',
  numero text not null default '',
  fecha date,
  neto numeric(18, 4) not null default 0,
  iva numeric(18, 4) not null default 0,
  total numeric(18, 0) not null default 0,
  cierra boolean not null default false,
  resumen text not null default '',
  creado_en timestamptz not null default now()
);

create table if not exists trabajadores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  rut text not null,
  nombre text not null,
  cargo text not null default '',
  area text not null default '',
  fecha_ingreso date not null,
  jornada text not null default 'Completa',
  sueldo_base numeric(18, 0) not null default 0,
  forma_pago text not null default 'transferencia',
  banco text not null default '',
  numero_cuenta text not null default '',
  modo_gratificacion text not null default 'ninguna' check (modo_gratificacion in ('ninguna', 'fija', 'legal')),
  gratificacion_fija numeric(18, 0) not null default 0,
  salud text not null default 'fonasa' check (salud in ('fonasa', 'isapre')),
  isapre_uf numeric(12, 4) not null default 0,
  isapre_pesos numeric(18, 0) not null default 0,
  afp_nombre text not null default '',
  colacion numeric(18, 0) not null default 0,
  colacion_imponible boolean not null default false,
  movilizacion numeric(18, 0) not null default 0,
  movilizacion_imponible boolean not null default false,
  activo boolean not null default true
);

create table if not exists asistencia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  trabajador_id uuid not null references trabajadores (id),
  fecha date not null,
  tipo text not null check (tipo in ('entrada', 'salida', 'atraso', 'inasistencia', 'permiso', 'vacaciones', 'licencia', 'feriado')),
  hora time,
  unique (trabajador_id, fecha, tipo)
);

create table if not exists parametros_anio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  anio integer not null,
  ingreso_minimo numeric(18, 0) not null default 0,
  porcentaje_gratificacion numeric(8, 4) not null default 0.25,
  factor_tope_gratificacion numeric(8, 4) not null default 4.75,
  recargo_hora_extra numeric(8, 4) not null default 0,
  recargo_domingo numeric(8, 4) not null default 0,
  horas_jornada numeric(8, 2) not null default 8,
  tasa_fonasa numeric(8, 4) not null default 0,
  tasa_cesantia numeric(8, 4) not null default 0,
  valor_uf numeric(18, 2) not null default 0,
  tope_imponible numeric(18, 0) not null default 0,
  unique (empresa_id, anio)
);

create table if not exists tramos_impuesto (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  anio integer not null,
  desde numeric(18, 0) not null,
  hasta numeric(18, 0),
  factor numeric(8, 4) not null,
  rebaja numeric(18, 4) not null default 0
);

create table if not exists afp_periodo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  anio integer not null,
  mes integer not null,
  nombre text not null,
  tasa numeric(8, 4) not null default 0,
  comision numeric(8, 4) not null default 0,
  seguro numeric(8, 4) not null default 0
);

create table if not exists bonos_area (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  area text not null,
  anio integer not null,
  mes integer not null,
  monto numeric(18, 0) not null default 0
);

create table if not exists liquidaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  trabajador_id uuid not null references trabajadores (id),
  anio integer not null,
  mes integer not null,
  detalle jsonb not null,
  imponible numeric(18, 0) not null,
  tributable numeric(18, 0) not null,
  liquido numeric(18, 0) not null,
  estado text not null default 'borrador' check (estado in ('borrador', 'pagada')),
  fecha_pago date,
  monto_pagado numeric(18, 0),
  medio text not null default '',
  unique (trabajador_id, anio, mes)
);

alter table rapeles enable row level security;
alter table rapel_facturas enable row level security;
alter table fotos_factura enable row level security;
alter table trabajadores enable row level security;
alter table asistencia enable row level security;
alter table parametros_anio enable row level security;
alter table tramos_impuesto enable row level security;
alter table afp_periodo enable row level security;
alter table bonos_area enable row level security;
alter table liquidaciones enable row level security;

drop policy if exists rap_sel on rapeles;
create policy rap_sel on rapeles for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists rap_ins on rapeles;
create policy rap_ins on rapeles for insert with check (empresa_id = empresa_actual() and tiene('crear'));
drop policy if exists rap_upd on rapeles;
create policy rap_upd on rapeles for update using (empresa_id = empresa_actual() and tiene('modificar'));

drop policy if exists rf_sel on rapel_facturas;
create policy rf_sel on rapel_facturas for select using (
  exists (select 1 from rapeles r where r.id = rapel_id and r.empresa_id = empresa_actual())
);
drop policy if exists rf_all on rapel_facturas;
create policy rf_all on rapel_facturas for all using (
  tiene('modificar') and exists (select 1 from rapeles r where r.id = rapel_id and r.empresa_id = empresa_actual())
) with check (
  tiene('crear') and exists (select 1 from rapeles r where r.id = rapel_id and r.empresa_id = empresa_actual())
);

drop policy if exists fot_sel on fotos_factura;
create policy fot_sel on fotos_factura for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists fot_ins on fotos_factura;
create policy fot_ins on fotos_factura for insert with check (empresa_id = empresa_actual() and tiene('crear'));
drop policy if exists fot_upd on fotos_factura;
create policy fot_upd on fotos_factura for update using (empresa_id = empresa_actual() and tiene('modificar'));

drop policy if exists tra_sel on trabajadores;
create policy tra_sel on trabajadores for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists tra_ins on trabajadores;
create policy tra_ins on trabajadores for insert with check (empresa_id = empresa_actual() and tiene('crear'));
drop policy if exists tra_upd on trabajadores;
create policy tra_upd on trabajadores for update using (empresa_id = empresa_actual() and tiene('modificar'));

drop policy if exists asi_sel on asistencia;
create policy asi_sel on asistencia for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists asi_ins on asistencia;
create policy asi_ins on asistencia for insert with check (empresa_id = empresa_actual() and tiene('crear'));
drop policy if exists asi_upd on asistencia;
create policy asi_upd on asistencia for update using (empresa_id = empresa_actual() and tiene('modificar'));

drop policy if exists par_all on parametros_anio;
create policy par_all on parametros_anio for all using (empresa_id = empresa_actual() and tiene('ver'))
with check (empresa_id = empresa_actual() and tiene('modificar'));
drop policy if exists tri_all on tramos_impuesto;
create policy tri_all on tramos_impuesto for all using (empresa_id = empresa_actual() and tiene('ver'))
with check (empresa_id = empresa_actual() and tiene('modificar'));
drop policy if exists afp_all on afp_periodo;
create policy afp_all on afp_periodo for all using (empresa_id = empresa_actual() and tiene('ver'))
with check (empresa_id = empresa_actual() and tiene('modificar'));
drop policy if exists bon_all on bonos_area;
create policy bon_all on bonos_area for all using (empresa_id = empresa_actual() and tiene('ver'))
with check (empresa_id = empresa_actual() and tiene('modificar'));
drop policy if exists liq_sel on liquidaciones;
create policy liq_sel on liquidaciones for select using (empresa_id = empresa_actual() and tiene('ver'));
drop policy if exists liq_ins on liquidaciones;
create policy liq_ins on liquidaciones for insert with check (empresa_id = empresa_actual() and tiene('crear'));
drop policy if exists liq_upd on liquidaciones;
create policy liq_upd on liquidaciones for update using (empresa_id = empresa_actual() and tiene('modificar'));

grant select, insert, update, delete on rapeles, rapel_facturas, fotos_factura, trabajadores, asistencia, parametros_anio, tramos_impuesto, afp_periodo, bonos_area, liquidaciones to authenticated;

insert into storage.buckets (id, name, public)
values ('facturas-fotos', 'facturas-fotos', false)
on conflict (id) do nothing;

drop policy if exists fotos_leer on storage.objects;
create policy fotos_leer on storage.objects for select to authenticated
using (bucket_id = 'facturas-fotos' and (storage.foldername(name))[1] = empresa_actual()::text);
drop policy if exists fotos_subir on storage.objects;
create policy fotos_subir on storage.objects for insert to authenticated
with check (bucket_id = 'facturas-fotos' and (storage.foldername(name))[1] = empresa_actual()::text);

do $$
begin
  alter publication supabase_realtime add table asistencia;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
