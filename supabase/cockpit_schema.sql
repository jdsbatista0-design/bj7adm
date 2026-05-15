-- =====================================================================
-- BJ7 Central — Cockpit / Motor de regras (Fase 0)
-- Cole INTEIRO no SQL Editor. Depois rode supabase/motor_regras.sql.
-- Pré-requisito: policies.sql + ensure_self_usuario.sql já aplicados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

create table if not exists public.regras (
  id            serial primary key,
  nome          text not null,
  descricao     text,
  tipo          text not null check (tipo in ('anomalia','limite','sla','duplicidade','categoria','projecao','importacao')),
  config        jsonb not null default '{}'::jsonb,
  severidade    text not null default 'warn' check (severidade in ('info','warn','critical')),
  gera_tarefa   boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create table if not exists public.regra_execucoes (
  id              bigserial primary key,
  regra_id        integer not null references public.regras(id) on delete cascade,
  executada_em    timestamptz not null default now(),
  alertas_criados integer not null default 0,
  duracao_ms      integer,
  erro            text
);
create index if not exists regra_exec_regra_idx on public.regra_execucoes (regra_id, executada_em desc);

create table if not exists public.alertas (
  id            bigserial primary key,
  regra_id      integer references public.regras(id) on delete set null,
  tipo          text not null,
  severidade    text not null default 'warn' check (severidade in ('info','warn','critical')),
  titulo        text not null,
  descricao     text,
  entidade_tipo text,
  entidade_id   text,
  empresa_id    integer references public.empresas(id) on delete cascade,
  payload       jsonb not null default '{}'::jsonb,
  dedupe_key    text not null,
  status        text not null default 'aberto' check (status in ('aberto','ack','resolvido','snoozed')),
  snooze_ate    timestamptz,
  criado_em     timestamptz not null default now(),
  ack_por       integer references public.usuarios(id),
  ack_em        timestamptz,
  resolvido_em  timestamptz,
  unique (dedupe_key)
);
create index if not exists alertas_status_idx on public.alertas (status, severidade, criado_em desc);
create index if not exists alertas_empresa_idx on public.alertas (empresa_id, status);

create table if not exists public.tarefas (
  id            bigserial primary key,
  titulo        text not null,
  descricao     text,
  responsavel_id integer references public.usuarios(id) on delete set null,
  criado_por    integer references public.usuarios(id) on delete set null,
  prioridade    text not null default 'media' check (prioridade in ('baixa','media','alta','urgente')),
  prazo         timestamptz,
  status        text not null default 'aberta' check (status in ('aberta','em_andamento','aguardando','concluida','cancelada')),
  entidade_tipo text,
  entidade_id   text,
  empresa_id    integer references public.empresas(id) on delete cascade,
  origem        text not null default 'manual' check (origem in ('manual','regra','alerta','sistema')),
  alerta_id     bigint references public.alertas(id) on delete set null,
  dedupe_key    text,
  criada_em     timestamptz not null default now(),
  concluida_em  timestamptz,
  unique (dedupe_key)
);
create index if not exists tarefas_resp_idx on public.tarefas (responsavel_id, status, prazo);
create index if not exists tarefas_status_idx on public.tarefas (status, prazo);

create table if not exists public.interacoes (
  id            bigserial primary key,
  entidade_tipo text not null,
  entidade_id   text not null,
  tipo          text not null check (tipo in ('nota','whatsapp','email','sistema','ligacao','visita')),
  conteudo      text,
  autor_id      integer references public.usuarios(id) on delete set null,
  payload       jsonb,
  criada_em     timestamptz not null default now()
);
create index if not exists interacoes_entidade_idx on public.interacoes (entidade_tipo, entidade_id, criada_em desc);

create table if not exists public.categoria_sugestoes (
  id            bigserial primary key,
  hash_descricao text not null unique,
  categoria_id  integer references public.categorias(id) on delete cascade,
  score         real not null default 1.0,
  hits          integer not null default 1,
  origem        text not null default 'humano' check (origem in ('humano','ia','regra')),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------

alter table public.regras              enable row level security;
alter table public.regra_execucoes     enable row level security;
alter table public.alertas             enable row level security;
alter table public.tarefas             enable row level security;
alter table public.interacoes          enable row level security;
alter table public.categoria_sugestoes enable row level security;

-- regras: leitura pra autenticado, escrita só admin
drop policy if exists regras_select on public.regras;
create policy regras_select on public.regras for select to authenticated using (true);

drop policy if exists regras_admin on public.regras;
create policy regras_admin on public.regras for all to authenticated
  using (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios))
  with check (exists (select 1 from public.current_user_perms() p where p.pode_gerir_usuarios));

drop policy if exists regra_exec_select on public.regra_execucoes;
create policy regra_exec_select on public.regra_execucoes for select to authenticated using (true);

-- alertas: visíveis se o usuário enxerga a empresa (ou se for global, empresa_id null)
drop policy if exists alertas_select on public.alertas;
create policy alertas_select on public.alertas for select to authenticated
  using (
    empresa_id is null
    or public.current_user_can_see_empresa(empresa_id)
  );

drop policy if exists alertas_update on public.alertas;
create policy alertas_update on public.alertas for update to authenticated
  using (empresa_id is null or public.current_user_can_see_empresa(empresa_id))
  with check (true);

-- tarefas: visíveis se o usuário enxerga a empresa OU é o responsável
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas for select to authenticated
  using (
    empresa_id is null
    or public.current_user_can_see_empresa(empresa_id)
    or responsavel_id in (
      select u.id from public.usuarios u where u.auth_uid = auth.uid()
    )
  );

drop policy if exists tarefas_insert on public.tarefas;
create policy tarefas_insert on public.tarefas for insert to authenticated
  with check (empresa_id is null or public.current_user_can_see_empresa(empresa_id));

drop policy if exists tarefas_update on public.tarefas;
create policy tarefas_update on public.tarefas for update to authenticated
  using (
    empresa_id is null
    or public.current_user_can_see_empresa(empresa_id)
    or responsavel_id in (select u.id from public.usuarios u where u.auth_uid = auth.uid())
  )
  with check (true);

drop policy if exists interacoes_select on public.interacoes;
create policy interacoes_select on public.interacoes for select to authenticated using (true);

drop policy if exists interacoes_insert on public.interacoes;
create policy interacoes_insert on public.interacoes for insert to authenticated
  with check (true);

drop policy if exists categoria_sug_select on public.categoria_sugestoes;
create policy categoria_sug_select on public.categoria_sugestoes for select to authenticated using (true);

drop policy if exists categoria_sug_write on public.categoria_sugestoes;
create policy categoria_sug_write on public.categoria_sugestoes for all to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. RPCs auxiliares para o Cockpit (acks rápidos do front)
-- ---------------------------------------------------------------------

create or replace function public.ack_alerta(_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid integer;
begin
  select u.id into v_uid from public.usuarios u where u.auth_uid = auth.uid() limit 1;
  update public.alertas
     set status = 'ack', ack_por = v_uid, ack_em = now()
   where id = _id and status = 'aberto';
end;
$$;
grant execute on function public.ack_alerta(bigint) to authenticated;

create or replace function public.resolver_alerta(_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid integer;
begin
  select u.id into v_uid from public.usuarios u where u.auth_uid = auth.uid() limit 1;
  update public.alertas
     set status = 'resolvido', ack_por = coalesce(ack_por, v_uid), resolvido_em = now()
   where id = _id;
end;
$$;
grant execute on function public.resolver_alerta(bigint) to authenticated;

create or replace function public.snooze_alerta(_id bigint, _horas integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.alertas
     set status = 'snoozed', snooze_ate = now() + make_interval(hours => _horas)
   where id = _id;
end;
$$;
grant execute on function public.snooze_alerta(bigint, integer) to authenticated;

create or replace function public.concluir_tarefa(_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tarefas
     set status = 'concluida', concluida_em = now()
   where id = _id;
end;
$$;
grant execute on function public.concluir_tarefa(bigint) to authenticated;
