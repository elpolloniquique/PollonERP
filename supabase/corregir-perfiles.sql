-- Corrección de la regla de usuarios. Ejecutar una sola vez en el SQL Editor.

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

grant execute on function soy_superadmin() to anon, authenticated;
grant execute on function soy_admin_de_empresa() to anon, authenticated;
