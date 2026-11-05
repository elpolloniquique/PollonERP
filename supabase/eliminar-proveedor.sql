-- Ejecutar una vez en el SQL Editor de Supabase.
-- Permite borrar un proveedor con productos, facturas, pagos y rapeles.

create or replace function eliminar_proveedor(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión.';
  end if;

  if not tiene('eliminar') then
    raise exception 'No tiene permiso para eliminar proveedores.';
  end if;

  v_empresa := empresa_actual();
  if v_empresa is null then
    raise exception 'No hay empresa activa.';
  end if;

  if not exists (
    select 1 from proveedores
    where id = p_id and empresa_id = v_empresa
  ) then
    raise exception 'No se encontró el proveedor.';
  end if;

  -- Rapel ligado a facturas del proveedor
  delete from rapel_facturas
  where factura_id in (select id from facturas where proveedor_id = p_id)
     or rapel_id in (select id from rapeles where proveedor_id = p_id);

  delete from rapeles
  where proveedor_id = p_id and empresa_id = v_empresa;

  -- Pagos y vínculos
  delete from pago_facturas
  where pago_id in (select id from pagos where proveedor_id = p_id)
     or factura_id in (select id from facturas where proveedor_id = p_id);

  delete from pagos
  where proveedor_id = p_id and empresa_id = v_empresa;

  -- Facturas (líneas por cascade)
  delete from facturas
  where proveedor_id = p_id and empresa_id = v_empresa;

  -- Fotos: soltar referencia
  update fotos_factura
  set proveedor_id = null
  where proveedor_id = p_id and empresa_id = v_empresa;

  -- Productos e impuestos por cascade al borrar proveedor
  delete from proveedores
  where id = p_id and empresa_id = v_empresa;
end;
$$;

grant execute on function eliminar_proveedor(uuid) to authenticated;

drop policy if exists prov_del on proveedores;
create policy prov_del on proveedores
  for delete
  using (empresa_id = empresa_actual() and tiene('eliminar'));
