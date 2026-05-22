-- =====================================================================
-- BJ7 Central — Módulo Pessoas
-- Tabelas em `public` (prefixo pessoas_*) para funcionar com a API REST
-- sem precisar expor o schema `pessoas` legado.
-- Cole este arquivo INTEIRO no SQL Editor do Supabase.
-- =====================================================================

-- ---------- 1. Tabelas ------------------------------------------------

create table if not exists public.pessoas_colaboradores (
  id          bigserial primary key,
  nome        text not null,
  email       text,
  cargo       text,
  area        text,
  gestor_id   bigint references public.pessoas_colaboradores(id) on delete set null,
  empresa_id  integer references public.empresas(id) on delete set null,
  data_admissao date,
  ativo       boolean not null default true,
  observacoes text,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz
);

create table if not exists public.pessoas_pdis (
  id            bigserial primary key,
  colaborador_id bigint not null references public.pessoas_colaboradores(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  prazo         date,
  status        text not null default 'aberto'
                check (status in ('aberto','em_andamento','concluido','cancelado')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists pessoas_pdis_colab_idx on public.pessoas_pdis(colaborador_id);

create table if not exists public.pessoas_okrs (
  id            bigserial primary key,
  ciclo         text not null,                         -- ex: 2026-Q1
  colaborador_id bigint references public.pessoas_colaboradores(id) on delete cascade,
  objetivo      text not null,
  key_result    text not null,
  progresso     numeric(5,2) not null default 0 check (progresso between 0 and 100),
  status        text not null default 'em_andamento'
                check (status in ('em_andamento','concluido','cancelado')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz
);
create index if not exists pessoas_okrs_ciclo_idx on public.pessoas_okrs(ciclo);

create table if not exists public.pessoas_one_on_ones (
  id            bigserial primary key,
  gestor_id     bigint not null references public.pessoas_colaboradores(id) on delete cascade,
  liderado_id   bigint not null references public.pessoas_colaboradores(id) on delete cascade,
  data          date not null,
  topicos       text,
  acoes         text,
  criado_em     timestamptz not null default now()
);
create index if not exists pessoas_one_on_ones_data_idx on public.pessoas_one_on_ones(data);

create table if not exists public.pessoas_rotina_rua (
  id            bigserial primary key,
  colaborador_id bigint not null references public.pessoas_colaboradores(id) on delete cascade,
  data          date not null,
  local         text,
  cliente       text,
  observacoes   text,
  criado_em     timestamptz not null default now()
);
create index if not exists pessoas_rotina_rua_data_idx on public.pessoas_rotina_rua(data);

-- ---------- 2. RLS ----------------------------------------------------
-- Padrão simples: qualquer usuário autenticado com registro em `usuarios`
-- ativo pode ler/gravar. Gestão fina pode evoluir depois.

alter table public.pessoas_colaboradores enable row level security;
alter table public.pessoas_pdis           enable row level security;
alter table public.pessoas_okrs           enable row level security;
alter table public.pessoas_one_on_ones    enable row level security;
alter table public.pessoas_rotina_rua     enable row level security;

create or replace function public.current_user_is_active()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
    where u.auth_uid = auth.uid() and coalesce(u.ativo, true)
  )
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'pessoas_colaboradores','pessoas_pdis','pessoas_okrs',
    'pessoas_one_on_ones','pessoas_rotina_rua'
  ] loop
    execute format('drop policy if exists "pessoas_select" on public.%I', t);
    execute format('drop policy if exists "pessoas_write"  on public.%I', t);
    execute format($p$create policy "pessoas_select" on public.%I
                     for select to authenticated
                     using (public.current_user_is_active())$p$, t);
    execute format($p$create policy "pessoas_write" on public.%I
                     for all to authenticated
                     using (public.current_user_is_active())
                     with check (public.current_user_is_active())$p$, t);
  end loop;
end $$;

-- ---------- 3. View de dashboard --------------------------------------

create or replace view public.pessoas_dashboard
with (security_invoker = on) as
select
  (select count(*) from public.pessoas_colaboradores where ativo)                 as colaboradores_ativos,
  (select count(*) from public.pessoas_pdis where status in ('aberto','em_andamento')) as pdis_abertos,
  (select count(*) from public.pessoas_okrs where status = 'em_andamento')        as okrs_em_andamento,
  (select count(*) from public.pessoas_one_on_ones where data >= current_date - interval '30 days') as one_on_ones_30d,
  (select count(*) from public.pessoas_rotina_rua where data >= current_date - interval '30 days')  as visitas_30d;

grant select on public.pessoas_dashboard to authenticated;
