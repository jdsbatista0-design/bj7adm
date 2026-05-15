-- =====================================================================
-- BJ7 Central — Auto-criação do registro em public.usuarios no 1º login
-- Cole INTEIRO no SQL Editor do Supabase. Roda como dono (SECURITY DEFINER),
-- então não depende das policies de INSERT em public.usuarios.
-- =====================================================================

create or replace function public.ensure_self_usuario()
returns public.usuarios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nome  text := coalesce(auth.jwt() -> 'user_metadata' ->> 'name', null);
  v_row   public.usuarios;
  v_papel_id integer;
  v_total_admins integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- 1. Já existe por auth_uid?
  select * into v_row from public.usuarios where auth_uid = v_uid limit 1;
  if found then
    return v_row;
  end if;

  -- 2. Existe por e-mail (cadastrado antes pelo admin) sem auth_uid? Vincula.
  if v_email <> '' then
    update public.usuarios
       set auth_uid = v_uid
     where lower(email) = v_email
       and auth_uid is null
    returning * into v_row;
    if found then
      return v_row;
    end if;
  end if;

  -- 3. Escolhe papel: bootstrap Admin se ainda não existe nenhum admin,
  --    senão papel mais restrito (ordem: menos permissões primeiro).
  select count(*) into v_total_admins
    from public.papeis
   where coalesce(pode_gerir_usuarios, false) = true;

  if v_total_admins = 0 or not exists (
    select 1 from public.usuarios u
      join public.papeis p on p.id = u.papel_id
     where coalesce(p.pode_gerir_usuarios, false) = true
       and coalesce(u.ativo, true) = true
  ) then
    -- Bootstrap: primeiro usuário do sistema vira Admin
    select id into v_papel_id
      from public.papeis
     where coalesce(pode_gerir_usuarios, false) = true
     order by id
     limit 1;
  else
    -- Já há admin: novo usuário entra com papel mais restrito
    select id into v_papel_id
      from public.papeis
     order by
       (coalesce(pode_gerir_usuarios, false))::int
     + (coalesce(pode_editar_revisado, false))::int
     + (coalesce(pode_marcar_revisado, false))::int
     + (coalesce(pode_editar_normal, false))::int
     + (coalesce(pode_lancar, false))::int
       asc,
       id asc
     limit 1;
  end if;

  if v_papel_id is null then
    raise exception 'nenhum papel cadastrado em public.papeis';
  end if;

  insert into public.usuarios (
    auth_uid, email, nome, papel_id, ativo,
    ve_retiradas, ve_faturamento, ve_todas_empresas
  ) values (
    v_uid,
    nullif(v_email, ''),
    coalesce(v_nome, v_email),
    v_papel_id,
    true,
    -- bootstrap Admin vê tudo; demais começam restritos
    case when v_total_admins = 0 then true else false end,
    case when v_total_admins = 0 then true else false end,
    case when v_total_admins = 0 then true else false end
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.ensure_self_usuario() from public;
grant execute on function public.ensure_self_usuario() to authenticated;
