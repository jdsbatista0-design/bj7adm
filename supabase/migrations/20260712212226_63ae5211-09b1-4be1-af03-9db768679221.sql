create or replace function public.ensure_self_usuario()
returns public.usuarios
language plpgsql security definer set search_path = public as $$
declare
  v_uid text := auth.uid()::text;
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_row public.usuarios;
begin
  if v_uid is null or v_uid = '' then
    raise exception 'auth.uid ausente';
  end if;

  select * into v_row from public.usuarios where auth_uid = v_uid limit 1;
  if found then
    return v_row;
  end if;

  select * into v_row from public.usuarios where lower(email) = v_email limit 1;
  if found then
    update public.usuarios
       set auth_uid = v_uid, ativo = true
     where id = v_row.id
     returning * into v_row;
    return v_row;
  end if;

  return null;
end;
$$;
grant execute on function public.ensure_self_usuario() to authenticated;

insert into public.usuarios (email, nome, papel_id, ve_retiradas, ve_faturamento, ve_todas_empresas, ativo)
select 'jdsbatista0@gmail.com', 'JDS Batista', p.id, true, true, true, true
from public.papeis p
where p.nome = 'Admin'
on conflict (email) do update set
  nome = excluded.nome,
  papel_id = excluded.papel_id,
  ve_retiradas = true,
  ve_faturamento = true,
  ve_todas_empresas = true,
  ativo = true;