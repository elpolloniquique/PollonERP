-- Lectura automática de facturas por foto o Telegram.
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table fotos_factura add column if not exists telegram_chat text not null default '';

do $$
declare
  regla record;
begin
  for regla in
    select conname
    from pg_constraint
    where conrelid = 'public.fotos_factura'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%estado%'
  loop
    execute format('alter table fotos_factura drop constraint %I', regla.conname);
  end loop;
end $$;

alter table fotos_factura
  add constraint fotos_factura_estado_check
  check (estado in ('borrador', 'confirmada', 'sin_proveedor', 'descartada'));
