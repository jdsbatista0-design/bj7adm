-- BJ7 Central recovery schema for a fresh Lovable Cloud backend

create table if not exists public.papeis (
  id serial primary key,
  nome text not null unique,
  ve_retiradas_padrao boolean default true,
  ve_faturamento_padrao boolean default true,
  ve_todas_empresas_padrao boolean default true,
  pode_lancar boolean default true,
  pode_editar_normal boolean default true,
  pode_editar_revisado boolean default true,
  pode_marcar_revisado boolean default true,
  pode_gerir_usuarios boolean default true,
  descricao text
);
grant select, insert, update, delete on public.papeis to authenticated;
grant all on public.papeis to service_role;
grant usage, select on sequence public.papeis_id_seq to authenticated;
alter table public.papeis enable row level security;

create table if not exists public.usuarios (
  id serial primary key,
  auth_uid text unique,
  nome text,
  email text unique,
  papel_id integer references public.papeis(id),
  ve_retiradas boolean default true,
  ve_faturamento boolean default true,
  ve_todas_empresas boolean default true,
  ativo boolean default true,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.usuarios to authenticated;
grant all on public.usuarios to service_role;
grant usage, select on sequence public.usuarios_id_seq to authenticated;
alter table public.usuarios enable row level security;

create table if not exists public.empresas (
  id serial primary key,
  nome text not null,
  descricao text,
  criado_em timestamptz default now(),
  ativa boolean default true
);
grant select, insert, update, delete on public.empresas to authenticated;
grant all on public.empresas to service_role;
grant usage, select on sequence public.empresas_id_seq to authenticated;
alter table public.empresas enable row level security;

create table if not exists public.unidades (
  id serial primary key,
  nome text not null,
  empresa_id integer not null references public.empresas(id) on delete cascade,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.unidades to authenticated;
grant all on public.unidades to service_role;
grant usage, select on sequence public.unidades_id_seq to authenticated;
alter table public.unidades enable row level security;

create table if not exists public.usuario_empresas (
  id serial primary key,
  usuario_id integer not null references public.usuarios(id) on delete cascade,
  empresa_id integer not null references public.empresas(id) on delete cascade,
  unique (usuario_id, empresa_id)
);
grant select, insert, update, delete on public.usuario_empresas to authenticated;
grant all on public.usuario_empresas to service_role;
grant usage, select on sequence public.usuario_empresas_id_seq to authenticated;
alter table public.usuario_empresas enable row level security;

create table if not exists public.categorias (
  id serial primary key,
  nome text not null,
  tipo_predominante text,
  grupo text,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.categorias to authenticated;
grant all on public.categorias to service_role;
grant usage, select on sequence public.categorias_id_seq to authenticated;
alter table public.categorias enable row level security;

create table if not exists public.lancamentos (
  id serial primary key,
  data date not null default current_date,
  ano integer not null default extract(year from now())::integer,
  mes integer not null default extract(month from now())::integer,
  empresa_id integer references public.empresas(id) on delete set null,
  unidade_id integer references public.unidades(id) on delete set null,
  categoria_id integer references public.categorias(id) on delete set null,
  tipo text not null default 'Despesa',
  subcategoria text,
  descricao text,
  valor numeric not null default 0,
  valor_sinal_original numeric,
  status text,
  origem_venda text,
  contar_no_total boolean not null default true,
  origem_classificacao text,
  arquivo_origem text,
  aba_origem text,
  linha_origem integer,
  hash_origem text,
  revisado boolean not null default false,
  revisado_por integer references public.usuarios(id) on delete set null,
  revisado_em timestamptz,
  importacao_id integer,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz default now(),
  fonte_caminho text,
  competencia text,
  auditado_por_banco boolean default false,
  auditado_em timestamptz,
  pluggy_transaction_id text
);
grant select, insert, update, delete on public.lancamentos to authenticated;
grant all on public.lancamentos to service_role;
grant usage, select on sequence public.lancamentos_id_seq to authenticated;
alter table public.lancamentos enable row level security;

create table if not exists public.notas_fiscais (
  id serial primary key,
  lancamento_id integer references public.lancamentos(id) on delete set null,
  ano integer,
  mes integer,
  data date,
  numero text,
  categoria_nota text,
  valor numeric,
  tomador text,
  arquivo text,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.notas_fiscais to authenticated;
grant all on public.notas_fiscais to service_role;
grant usage, select on sequence public.notas_fiscais_id_seq to authenticated;
alter table public.notas_fiscais enable row level security;

create table if not exists public.apuracao_rebate (
  id serial primary key,
  ano integer,
  mes text,
  qtd_clientes integer,
  lucro_bruto numeric,
  aliquota numeric,
  rebate_lb numeric,
  remuneracao_final numeric,
  nota_fiscal numeric,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.apuracao_rebate to authenticated;
grant all on public.apuracao_rebate to service_role;
grant usage, select on sequence public.apuracao_rebate_id_seq to authenticated;
alter table public.apuracao_rebate enable row level security;

create table if not exists public.evolucao_base_clientes (
  id serial primary key,
  ano integer,
  mes text,
  qtd_clientes integer,
  novos_no_mes integer,
  sumiram_no_mes integer,
  lucro_bruto_total numeric,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.evolucao_base_clientes to authenticated;
grant all on public.evolucao_base_clientes to service_role;
grant usage, select on sequence public.evolucao_base_clientes_id_seq to authenticated;
alter table public.evolucao_base_clientes enable row level security;

create table if not exists public.clientes_sumidos (
  id serial primary key,
  sumiu_em date,
  stone_code text,
  nome_fantasia text,
  ultimo_lucro numeric,
  status_mes_anterior text,
  atencao boolean default false,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.clientes_sumidos to authenticated;
grant all on public.clientes_sumidos to service_role;
grant usage, select on sequence public.clientes_sumidos_id_seq to authenticated;
alter table public.clientes_sumidos enable row level security;

create table if not exists public.importacoes (
  id serial primary key,
  arquivo text,
  descricao text,
  linhas_recebidas integer,
  linhas_inseridas integer,
  linhas_ignoradas integer,
  importado_por integer references public.usuarios(id) on delete set null,
  importado_em timestamptz default now()
);
grant select, insert, update, delete on public.importacoes to authenticated;
grant all on public.importacoes to service_role;
grant usage, select on sequence public.importacoes_id_seq to authenticated;
alter table public.importacoes enable row level security;

create or replace function public.current_user_perms()
returns table (
  usuario_id integer,
  ve_retiradas boolean,
  ve_faturamento boolean,
  ve_todas_empresas boolean,
  pode_lancar boolean,
  pode_editar_normal boolean,
  pode_editar_revisado boolean,
  pode_marcar_revisado boolean,
  pode_gerir_usuarios boolean
)
language sql stable security definer set search_path = public as $$
  select u.id,
         coalesce(u.ve_retiradas, false),
         coalesce(u.ve_faturamento, false),
         coalesce(u.ve_todas_empresas, false),
         coalesce(p.pode_lancar, false),
         coalesce(p.pode_editar_normal, false),
         coalesce(p.pode_editar_revisado, false),
         coalesce(p.pode_marcar_revisado, false),
         coalesce(p.pode_gerir_usuarios, false)
  from public.usuarios u
  left join public.papeis p on p.id = u.papel_id
  where u.auth_uid = auth.uid()::text and coalesce(u.ativo, true) = true
$$;
grant execute on function public.current_user_perms() to authenticated;

create or replace function public.current_user_empresa_ids()
returns setof integer language sql stable security definer set search_path = public as $$
  select ue.empresa_id
  from public.usuario_empresas ue
  join public.usuarios u on u.id = ue.usuario_id
  where u.auth_uid = auth.uid()::text
$$;
grant execute on function public.current_user_empresa_ids() to authenticated;

create or replace function public.current_user_can_see_empresa(_empresa_id integer)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select ve_todas_empresas from public.current_user_perms() limit 1), false)
    or _empresa_id in (select public.current_user_empresa_ids())
$$;
grant execute on function public.current_user_can_see_empresa(integer) to authenticated;

create or replace function public.current_user_can_see_tipo(_tipo text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when _tipo = 'Receita' then coalesce((select ve_faturamento from public.current_user_perms() limit 1), false)
    when _tipo = 'Retirada' then coalesce((select ve_retiradas from public.current_user_perms() limit 1), false)
    else true
  end
$$;
grant execute on function public.current_user_can_see_tipo(text) to authenticated;

drop policy if exists papeis_select on public.papeis;
create policy papeis_select on public.papeis for select to authenticated using (true);
drop policy if exists papeis_admin on public.papeis;
create policy papeis_admin on public.papeis for all to authenticated using (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios)) with check (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));

drop policy if exists usuarios_select_self on public.usuarios;
create policy usuarios_select_self on public.usuarios for select to authenticated using (auth_uid = auth.uid()::text or (auth_uid is null and lower(email) = lower(coalesce(auth.jwt()->>'email', ''))) or exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));
drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin on public.usuarios for update to authenticated using (auth_uid = auth.uid()::text or exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios)) with check (true);
drop policy if exists usuarios_insert_admin on public.usuarios;
create policy usuarios_insert_admin on public.usuarios for insert to authenticated with check (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));

drop policy if exists all_auth_empresas on public.empresas;
create policy all_auth_empresas on public.empresas for all to authenticated using (true) with check (true);
drop policy if exists all_auth_unidades on public.unidades;
create policy all_auth_unidades on public.unidades for all to authenticated using (true) with check (true);
drop policy if exists all_auth_usuario_empresas on public.usuario_empresas;
create policy all_auth_usuario_empresas on public.usuario_empresas for all to authenticated using (true) with check (true);
drop policy if exists all_auth_categorias on public.categorias;
create policy all_auth_categorias on public.categorias for all to authenticated using (true) with check (true);
drop policy if exists all_auth_lancamentos on public.lancamentos;
create policy all_auth_lancamentos on public.lancamentos for all to authenticated using (true) with check (true);
drop policy if exists all_auth_notas_fiscais on public.notas_fiscais;
create policy all_auth_notas_fiscais on public.notas_fiscais for all to authenticated using (true) with check (true);
drop policy if exists all_auth_apuracao_rebate on public.apuracao_rebate;
create policy all_auth_apuracao_rebate on public.apuracao_rebate for all to authenticated using (true) with check (true);
drop policy if exists all_auth_evolucao_base_clientes on public.evolucao_base_clientes;
create policy all_auth_evolucao_base_clientes on public.evolucao_base_clientes for all to authenticated using (true) with check (true);
drop policy if exists all_auth_clientes_sumidos on public.clientes_sumidos;
create policy all_auth_clientes_sumidos on public.clientes_sumidos for all to authenticated using (true) with check (true);
drop policy if exists all_auth_importacoes on public.importacoes;
create policy all_auth_importacoes on public.importacoes for all to authenticated using (true) with check (true);

insert into public.papeis (nome, descricao, ve_retiradas_padrao, ve_faturamento_padrao, ve_todas_empresas_padrao, pode_lancar, pode_editar_normal, pode_editar_revisado, pode_marcar_revisado, pode_gerir_usuarios)
values ('Admin', 'Administrador do sistema', true, true, true, true, true, true, true, true)
on conflict (nome) do update set
  ve_retiradas_padrao = excluded.ve_retiradas_padrao,
  ve_faturamento_padrao = excluded.ve_faturamento_padrao,
  ve_todas_empresas_padrao = excluded.ve_todas_empresas_padrao,
  pode_lancar = excluded.pode_lancar,
  pode_editar_normal = excluded.pode_editar_normal,
  pode_editar_revisado = excluded.pode_editar_revisado,
  pode_marcar_revisado = excluded.pode_marcar_revisado,
  pode_gerir_usuarios = excluded.pode_gerir_usuarios;

insert into public.empresas (nome, descricao, ativa)
values ('BJ7', 'Empresa padrão', true)
on conflict do nothing;

create or replace function public.ensure_self_usuario()
returns public.usuarios
language plpgsql security definer set search_path = public as $$
declare
  v_uid text := auth.uid()::text;
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_row public.usuarios;
  v_papel_id integer;
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

  select id into v_papel_id from public.papeis where coalesce(pode_gerir_usuarios, false) = true order by id limit 1;
  if v_papel_id is null then
    insert into public.papeis (nome) values ('Admin') returning id into v_papel_id;
  end if;

  insert into public.usuarios (auth_uid, nome, email, papel_id, ve_retiradas, ve_faturamento, ve_todas_empresas, ativo)
  values (v_uid, split_part(v_email, '@', 1), v_email, v_papel_id, true, true, true, true)
  returning * into v_row;

  return v_row;
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
