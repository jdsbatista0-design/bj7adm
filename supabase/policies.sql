-- =====================================================================
-- BJ7 Central — Row-Level Security
-- Cole este arquivo INTEIRO no SQL Editor do Supabase do projeto BJ7.
-- Pré-requisito: a coluna usuarios.auth_uid deve estar preenchida com o
-- auth.users.id de cada usuário (use a tela /usuarios pra vincular ou
-- rode UPDATEs manuais antes de habilitar RLS).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Funções helper (SECURITY DEFINER → não disparam RLS recursivo)
-- ---------------------------------------------------------------------

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
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
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
  where u.auth_uid = auth.uid()
    and coalesce(u.ativo, true) = true
$$;

create or replace function public.current_user_empresa_ids()
returns setof integer
language sql
stable
security definer
set search_path = public
as $$
  select ue.empresa_id
  from public.usuario_empresas ue
  join public.usuarios u on u.id = ue.usuario_id
  where u.auth_uid = auth.uid()
$$;

create or replace function public.current_user_can_see_empresa(_empresa_id integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.current_user_perms() p where p.ve_todas_empresas
  ) or _empresa_id in (select public.current_user_empresa_ids())
$$;

create or replace function public.current_user_can_see_tipo(_tipo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when _tipo = 'Receita'   then (select ve_faturamento from public.current_user_perms() limit 1)
    when _tipo = 'Retirada'  then (select ve_retiradas    from public.current_user_perms() limit 1)
    else true
  end
$$;

-- ---------------------------------------------------------------------
-- 2. Habilitar RLS em todas as tabelas
-- ---------------------------------------------------------------------

alter table public.empresas               enable row level security;
alter table public.unidades               enable row level security;
alter table public.categorias             enable row level security;
alter table public.lancamentos            enable row level security;
alter table public.notas_fiscais          enable row level security;
alter table public.apuracao_rebate        enable row level security;
alter table public.evolucao_base_clientes enable row level security;
alter table public.clientes_sumidos       enable row level security;
alter table public.papeis                 enable row level security;
alter table public.usuarios               enable row level security;
alter table public.usuario_empresas       enable row level security;
alter table public.importacoes            enable row level security;

-- ---------------------------------------------------------------------
-- 3. Tabelas de referência: leitura liberada pra autenticados
-- ---------------------------------------------------------------------

drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas for select to authenticated using (true);

drop policy if exists unidades_select on public.unidades;
create policy unidades_select on public.unidades for select to authenticated using (true);

drop policy if exists categorias_select on public.categorias;
create policy categorias_select on public.categorias for select to authenticated using (true);

drop policy if exists papeis_select on public.papeis;
create policy papeis_select on public.papeis for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- 4. Lançamentos — gate por tipo + empresa + revisado
-- ---------------------------------------------------------------------

drop policy if exists lancamentos_select on public.lancamentos;
create policy lancamentos_select on public.lancamentos
  for select to authenticated
  using (
    public.current_user_can_see_tipo(tipo)
    and public.current_user_can_see_empresa(empresa_id)
  );

drop policy if exists lancamentos_insert on public.lancamentos;
create policy lancamentos_insert on public.lancamentos
  for insert to authenticated
  with check (
    exists (select 1 from public.current_user_perms() p where p.pode_lancar)
    and public.current_user_can_see_tipo(tipo)
    and public.current_user_can_see_empresa(empresa_id)
  );

drop policy if exists lancamentos_update on public.lancamentos;
create policy lancamentos_update on public.lancamentos
  for update to authenticated
  using (
    public.current_user_can_see_tipo(tipo)
    and public.current_user_can_see_empresa(empresa_id)
    and (
      (revisado = false and exists (select 1 from public.current_user_perms() p where p.pode_editar_normal))
      or
      (revisado = true  and exists (select 1 from public.current_user_perms() p where p.pode_editar_revisado))
      or
      -- Quem pode marcar revisado consegue alternar o flag (marcar/desmarcar)
      -- mesmo sem pode_editar_normal/revisado. O app só expõe o toggle do
      -- campo `revisado` para esse papel; se precisar de garantia a nível de
      -- coluna no banco, troque por uma função SECURITY DEFINER dedicada.
      exists (select 1 from public.current_user_perms() p where p.pode_marcar_revisado)
    )
  )
  with check (
    public.current_user_can_see_tipo(tipo)
    and public.current_user_can_see_empresa(empresa_id)
  );

drop policy if exists lancamentos_delete on public.lancamentos;
create policy lancamentos_delete on public.lancamentos
  for delete to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));

-- ---------------------------------------------------------------------
-- 5. Stone (faturamento) — apenas ve_faturamento
-- ---------------------------------------------------------------------

drop policy if exists notas_select on public.notas_fiscais;
create policy notas_select on public.notas_fiscais
  for select to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.ve_faturamento));

drop policy if exists rebate_select on public.apuracao_rebate;
create policy rebate_select on public.apuracao_rebate
  for select to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.ve_faturamento));

drop policy if exists evolucao_select on public.evolucao_base_clientes;
create policy evolucao_select on public.evolucao_base_clientes
  for select to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.ve_faturamento));

drop policy if exists sumidos_select on public.clientes_sumidos;
create policy sumidos_select on public.clientes_sumidos
  for select to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.ve_faturamento));

-- ---------------------------------------------------------------------
-- 6. Usuários e vínculos — só Admin/Sócio (pode_gerir_usuarios)
-- ---------------------------------------------------------------------

drop policy if exists usuarios_select_self on public.usuarios;
create policy usuarios_select_self on public.usuarios
  for select to authenticated
  using (
    auth_uid = auth.uid()
    or (auth_uid is null and lower(email) = lower(coalesce(auth.jwt()->>'email', '')))
    or exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios)
  );

drop policy if exists usuarios_update_admin on public.usuarios;
create policy usuarios_update_admin on public.usuarios
  for update to authenticated
  using (
    auth_uid = auth.uid()
    or exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios)
  )
  with check (true);

drop policy if exists usuarios_insert_admin on public.usuarios;
create policy usuarios_insert_admin on public.usuarios
  for insert to authenticated
  with check (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));

drop policy if exists ue_all_admin on public.usuario_empresas;
create policy ue_all_admin on public.usuario_empresas
  for all to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios))
  with check (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));

drop policy if exists ue_select_self on public.usuario_empresas;
create policy ue_select_self on public.usuario_empresas
  for select to authenticated
  using (
    exists (
      select 1
      from public.usuarios u
      where u.id = usuario_id
        and u.auth_uid = auth.uid()
    )
    or exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios)
  );

-- ---------------------------------------------------------------------
-- 7. Importações — só quem pode importar (Admin/Sócio)
-- ---------------------------------------------------------------------

drop policy if exists importacoes_all on public.importacoes;
create policy importacoes_all on public.importacoes
  for all to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios))
  with check (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));
