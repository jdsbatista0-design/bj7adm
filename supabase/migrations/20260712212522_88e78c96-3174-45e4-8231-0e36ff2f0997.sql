-- Remaining app tables/views after backend recovery

create table if not exists public.regras (
  id serial primary key,
  nome text not null,
  descricao text,
  tipo text not null default 'manual',
  config jsonb not null default '{}'::jsonb,
  severidade text not null default 'warn',
  gera_tarefa boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.regras to authenticated;
grant all on public.regras to service_role;
grant usage, select on sequence public.regras_id_seq to authenticated;
alter table public.regras enable row level security;
drop policy if exists all_auth_regras on public.regras;
create policy all_auth_regras on public.regras for all to authenticated using (true) with check (true);

create table if not exists public.alertas (
  id bigserial primary key,
  regra_id integer references public.regras(id) on delete set null,
  tipo text not null,
  severidade text not null default 'warn',
  titulo text not null,
  descricao text,
  entidade_tipo text,
  entidade_id text,
  empresa_id integer references public.empresas(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'aberto',
  snooze_ate timestamptz,
  criado_em timestamptz not null default now(),
  ack_por integer references public.usuarios(id),
  ack_em timestamptz,
  resolvido_em timestamptz
);
grant select, insert, update, delete on public.alertas to authenticated;
grant all on public.alertas to service_role;
grant usage, select on sequence public.alertas_id_seq to authenticated;
alter table public.alertas enable row level security;
drop policy if exists all_auth_alertas on public.alertas;
create policy all_auth_alertas on public.alertas for all to authenticated using (true) with check (true);

create table if not exists public.tarefas (
  id bigserial primary key,
  titulo text not null,
  descricao text,
  responsavel_id integer references public.usuarios(id) on delete set null,
  criado_por integer references public.usuarios(id) on delete set null,
  prioridade text not null default 'media',
  prazo timestamptz,
  status text not null default 'aberta',
  entidade_tipo text,
  entidade_id text,
  empresa_id integer references public.empresas(id) on delete cascade,
  origem text not null default 'manual',
  alerta_id bigint references public.alertas(id) on delete set null,
  dedupe_key text unique,
  criada_em timestamptz not null default now(),
  concluida_em timestamptz
);
create index if not exists tarefas_status_idx on public.tarefas(status, prazo);
grant select, insert, update, delete on public.tarefas to authenticated;
grant all on public.tarefas to service_role;
grant usage, select on sequence public.tarefas_id_seq to authenticated;
alter table public.tarefas enable row level security;
drop policy if exists all_auth_tarefas on public.tarefas;
create policy all_auth_tarefas on public.tarefas for all to authenticated using (true) with check (true);

create table if not exists public.interacoes (
  id bigserial primary key,
  entidade_tipo text not null,
  entidade_id text not null,
  tipo text not null default 'nota',
  conteudo text,
  autor_id integer references public.usuarios(id) on delete set null,
  payload jsonb,
  criada_em timestamptz not null default now()
);
grant select, insert, update, delete on public.interacoes to authenticated;
grant all on public.interacoes to service_role;
grant usage, select on sequence public.interacoes_id_seq to authenticated;
alter table public.interacoes enable row level security;
drop policy if exists all_auth_interacoes on public.interacoes;
create policy all_auth_interacoes on public.interacoes for all to authenticated using (true) with check (true);

create table if not exists public.categoria_sugestoes (
  id bigserial primary key,
  hash_descricao text not null unique,
  categoria_id integer references public.categorias(id) on delete cascade,
  score real not null default 1,
  hits integer not null default 1,
  origem text not null default 'humano',
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.categoria_sugestoes to authenticated;
grant all on public.categoria_sugestoes to service_role;
grant usage, select on sequence public.categoria_sugestoes_id_seq to authenticated;
alter table public.categoria_sugestoes enable row level security;
drop policy if exists all_auth_categoria_sugestoes on public.categoria_sugestoes;
create policy all_auth_categoria_sugestoes on public.categoria_sugestoes for all to authenticated using (true) with check (true);

create table if not exists public.itens (
  id serial primary key,
  titulo text not null,
  descricao text,
  tipo text default 'TAREFA',
  eixo_bj7 text,
  empresa_id integer references public.empresas(id),
  importante boolean default false,
  urgente boolean default false,
  energia text,
  contexto text,
  estado text default 'BACKLOG',
  prazo date,
  data_reuniao timestamptz,
  duracao_min integer,
  participantes text[],
  local_reuniao text,
  opcoes_decisao jsonb,
  decisao_tomada text,
  decisao_em date,
  item_pai_id integer references public.itens(id),
  tags text[],
  notas text,
  concluido_em timestamptz,
  recorrencia text,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.itens to authenticated;
grant all on public.itens to service_role;
grant usage, select on sequence public.itens_id_seq to authenticated;
alter table public.itens enable row level security;
drop policy if exists all_auth_itens on public.itens;
create policy all_auth_itens on public.itens for all to authenticated using (true) with check (true);

create table if not exists public.contas_a_pagar (
  id serial primary key,
  grupo_id text,
  descricao text not null,
  valor numeric not null default 0,
  vencimento date not null default current_date,
  empresa_id integer references public.empresas(id) on delete set null,
  categoria_id integer references public.categorias(id) on delete set null,
  recorrencia text not null default 'unica',
  pago boolean not null default false,
  data_pagamento date,
  valor_pago numeric,
  observacao text,
  lancamento_id integer references public.lancamentos(id) on delete set null,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.contas_a_pagar to authenticated;
grant all on public.contas_a_pagar to service_role;
grant usage, select on sequence public.contas_a_pagar_id_seq to authenticated;
alter table public.contas_a_pagar enable row level security;
drop policy if exists all_auth_contas_a_pagar on public.contas_a_pagar;
create policy all_auth_contas_a_pagar on public.contas_a_pagar for all to authenticated using (true) with check (true);

create table if not exists public.obrigacoes_fiscais (
  id serial primary key,
  empresa_id integer references public.empresas(id) on delete set null,
  tipo text not null,
  descricao text,
  competencia text not null,
  vencimento date not null,
  valor numeric,
  status text not null default 'pendente',
  data_pagamento date,
  valor_pago numeric,
  guia_url text,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.obrigacoes_fiscais to authenticated;
grant all on public.obrigacoes_fiscais to service_role;
grant usage, select on sequence public.obrigacoes_fiscais_id_seq to authenticated;
alter table public.obrigacoes_fiscais enable row level security;
drop policy if exists all_auth_obrigacoes_fiscais on public.obrigacoes_fiscais;
create policy all_auth_obrigacoes_fiscais on public.obrigacoes_fiscais for all to authenticated using (true) with check (true);

create table if not exists public.notas_rapidas (
  id serial primary key,
  conteudo text not null,
  tipo text not null default 'nota',
  empresa_id integer references public.empresas(id) on delete set null,
  fixada boolean not null default false,
  arquivada boolean not null default false,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.notas_rapidas to authenticated;
grant all on public.notas_rapidas to service_role;
grant usage, select on sequence public.notas_rapidas_id_seq to authenticated;
alter table public.notas_rapidas enable row level security;
drop policy if exists all_auth_notas_rapidas on public.notas_rapidas;
create policy all_auth_notas_rapidas on public.notas_rapidas for all to authenticated using (true) with check (true);

create table if not exists public.juridico_processos (
  id serial primary key,
  empresa_id integer references public.empresas(id) on delete set null,
  numero text,
  tipo text not null default 'processo',
  descricao text,
  contraparte text,
  advogado text,
  vara text,
  status text not null default 'ativo',
  polo text,
  valor_causa numeric,
  valor_provisao numeric,
  proxima_audiencia date,
  data_inicio date,
  data_encerramento date,
  resultado text,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.juridico_processos to authenticated;
grant all on public.juridico_processos to service_role;
grant usage, select on sequence public.juridico_processos_id_seq to authenticated;
alter table public.juridico_processos enable row level security;
drop policy if exists all_auth_juridico_processos on public.juridico_processos;
create policy all_auth_juridico_processos on public.juridico_processos for all to authenticated using (true) with check (true);

create table if not exists public.mkt_campanhas (
  id serial primary key,
  empresa_id integer references public.empresas(id) on delete set null,
  nome text not null,
  canal text not null default 'geral',
  status text not null default 'planejada',
  objetivo text,
  data_inicio date,
  data_fim date,
  orcamento numeric,
  gasto_realizado numeric,
  leads_gerados integer,
  conversoes integer,
  resultado text,
  observacao text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.mkt_campanhas to authenticated;
grant all on public.mkt_campanhas to service_role;
grant usage, select on sequence public.mkt_campanhas_id_seq to authenticated;
alter table public.mkt_campanhas enable row level security;
drop policy if exists all_auth_mkt_campanhas on public.mkt_campanhas;
create policy all_auth_mkt_campanhas on public.mkt_campanhas for all to authenticated using (true) with check (true);

create table if not exists public.pessoas_colaboradores (
  id bigserial primary key,
  nome text not null,
  email text,
  cargo text,
  area text,
  gestor_id bigint references public.pessoas_colaboradores(id) on delete set null,
  empresa_id integer references public.empresas(id) on delete set null,
  data_admissao date,
  ativo boolean not null default true,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
grant select, insert, update, delete on public.pessoas_colaboradores to authenticated;
grant all on public.pessoas_colaboradores to service_role;
grant usage, select on sequence public.pessoas_colaboradores_id_seq to authenticated;
alter table public.pessoas_colaboradores enable row level security;
drop policy if exists all_auth_pessoas_colaboradores on public.pessoas_colaboradores;
create policy all_auth_pessoas_colaboradores on public.pessoas_colaboradores for all to authenticated using (true) with check (true);

create table if not exists public.pessoas_pdis (
  id bigserial primary key,
  colaborador_id bigint references public.pessoas_colaboradores(id) on delete cascade,
  titulo text not null,
  descricao text,
  prazo date,
  status text not null default 'aberto',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
grant select, insert, update, delete on public.pessoas_pdis to authenticated;
grant all on public.pessoas_pdis to service_role;
grant usage, select on sequence public.pessoas_pdis_id_seq to authenticated;
alter table public.pessoas_pdis enable row level security;
drop policy if exists all_auth_pessoas_pdis on public.pessoas_pdis;
create policy all_auth_pessoas_pdis on public.pessoas_pdis for all to authenticated using (true) with check (true);

create table if not exists public.pessoas_okrs (
  id bigserial primary key,
  ciclo text not null,
  colaborador_id bigint references public.pessoas_colaboradores(id) on delete cascade,
  objetivo text not null,
  key_result text not null,
  progresso numeric(5,2) not null default 0,
  status text not null default 'em_andamento',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz
);
grant select, insert, update, delete on public.pessoas_okrs to authenticated;
grant all on public.pessoas_okrs to service_role;
grant usage, select on sequence public.pessoas_okrs_id_seq to authenticated;
alter table public.pessoas_okrs enable row level security;
drop policy if exists all_auth_pessoas_okrs on public.pessoas_okrs;
create policy all_auth_pessoas_okrs on public.pessoas_okrs for all to authenticated using (true) with check (true);

create table if not exists public.pessoas_one_on_ones (
  id bigserial primary key,
  gestor_id bigint references public.pessoas_colaboradores(id) on delete cascade,
  liderado_id bigint references public.pessoas_colaboradores(id) on delete cascade,
  data date not null default current_date,
  topicos text,
  acoes text,
  criado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.pessoas_one_on_ones to authenticated;
grant all on public.pessoas_one_on_ones to service_role;
grant usage, select on sequence public.pessoas_one_on_ones_id_seq to authenticated;
alter table public.pessoas_one_on_ones enable row level security;
drop policy if exists all_auth_pessoas_one_on_ones on public.pessoas_one_on_ones;
create policy all_auth_pessoas_one_on_ones on public.pessoas_one_on_ones for all to authenticated using (true) with check (true);

create table if not exists public.pessoas_rotina_rua (
  id bigserial primary key,
  colaborador_id bigint references public.pessoas_colaboradores(id) on delete cascade,
  data date not null default current_date,
  local text,
  cliente text,
  observacoes text,
  criado_em timestamptz not null default now()
);
grant select, insert, update, delete on public.pessoas_rotina_rua to authenticated;
grant all on public.pessoas_rotina_rua to service_role;
grant usage, select on sequence public.pessoas_rotina_rua_id_seq to authenticated;
alter table public.pessoas_rotina_rua enable row level security;
drop policy if exists all_auth_pessoas_rotina_rua on public.pessoas_rotina_rua;
create policy all_auth_pessoas_rotina_rua on public.pessoas_rotina_rua for all to authenticated using (true) with check (true);

create table if not exists public.stone_rebate_imports (
  id bigserial primary key,
  arquivo_nome text not null,
  arquivo_hash text not null,
  usuario_id integer references public.usuarios(id) on delete set null,
  empresa_id integer references public.empresas(id) on delete set null,
  periodo_inicio date,
  periodo_fim date,
  mes_referencia date,
  status text not null default 'pendente',
  total_linhas integer not null default 0,
  linhas_ok integer not null default 0,
  linhas_erro integer not null default 0,
  linhas_duplicadas integer not null default 0,
  valor_total_rebate numeric not null default 0,
  conta_a_pagar_id integer references public.contas_a_pagar(id) on delete set null,
  lancamento_id integer references public.lancamentos(id) on delete set null,
  observacao text,
  mapeamento_json jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.stone_rebate_imports to authenticated;
grant all on public.stone_rebate_imports to service_role;
grant usage, select on sequence public.stone_rebate_imports_id_seq to authenticated;
alter table public.stone_rebate_imports enable row level security;
drop policy if exists all_auth_stone_rebate_imports on public.stone_rebate_imports;
create policy all_auth_stone_rebate_imports on public.stone_rebate_imports for all to authenticated using (true) with check (true);

create table if not exists public.stone_rebate_linhas (
  id bigserial primary key,
  import_id bigint references public.stone_rebate_imports(id) on delete cascade,
  linha_num integer not null,
  stonecode text,
  documento text,
  nome_cliente text,
  data_referencia date,
  mes_referencia date,
  tpv numeric,
  receita_bruta numeric,
  rebate_valor numeric,
  mdr numeric,
  antecipacao numeric,
  aluguel numeric,
  produto text,
  bandeira text,
  canal text,
  cidade text,
  rota text,
  status_conciliacao text default 'ok',
  erro_importacao text,
  dados_originais_json jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.stone_rebate_linhas to authenticated;
grant all on public.stone_rebate_linhas to service_role;
grant usage, select on sequence public.stone_rebate_linhas_id_seq to authenticated;
alter table public.stone_rebate_linhas enable row level security;
drop policy if exists all_auth_stone_rebate_linhas on public.stone_rebate_linhas;
create policy all_auth_stone_rebate_linhas on public.stone_rebate_linhas for all to authenticated using (true) with check (true);

create or replace view public.dre_consolidada as
select
  l.empresa_id,
  date_trunc('month', l.data)::date as mes_ref,
  l.tipo,
  c.grupo,
  c.tipo_predominante as natureza_dre,
  true as entra_dre,
  true as entra_dre_operacional,
  count(*)::integer as qtd_lancamentos,
  coalesce(sum(l.valor), 0)::numeric as valor_total
from public.lancamentos l
left join public.categorias c on c.id = l.categoria_id
group by l.empresa_id, date_trunc('month', l.data)::date, l.tipo, c.grupo, c.tipo_predominante;
grant select on public.dre_consolidada to authenticated;

create or replace view public.dre_operacional as
select
  l.empresa_id,
  e.nome as empresa,
  l.ano,
  l.mes,
  date_trunc('month', l.data)::date as mes_ref,
  c.tipo_predominante as natureza,
  c.grupo,
  c.nome as categoria,
  count(*)::integer as qtd_lancamentos,
  coalesce(sum(l.valor), 0)::numeric as valor_total
from public.lancamentos l
left join public.empresas e on e.id = l.empresa_id
left join public.categorias c on c.id = l.categoria_id
group by l.empresa_id, e.nome, l.ano, l.mes, date_trunc('month', l.data)::date, c.tipo_predominante, c.grupo, c.nome;
grant select on public.dre_operacional to authenticated;

create or replace view public.v_resumo_dre as
select
  e.id as empresa_id,
  e.nome as empresa,
  extract(year from coalesce(l.data, current_date))::integer as ano,
  coalesce(sum(case when l.tipo = 'Receita' then l.valor else 0 end),0)::numeric as receita_operacional,
  coalesce(sum(case when l.tipo = 'Despesa' then l.valor else 0 end),0)::numeric as despesa_operacional,
  coalesce(sum(case when l.tipo = 'Receita' then l.valor when l.tipo = 'Despesa' then -l.valor else 0 end),0)::numeric as ebitda_operacional,
  0::numeric as despesa_nao_operacional,
  0::numeric as investimentos,
  0::numeric as movimentacao_patrimonial,
  coalesce(sum(case when l.tipo = 'Receita' then l.valor when l.tipo = 'Despesa' then -l.valor else 0 end),0)::numeric as lucro_liquido_pre_capex
from public.empresas e
left join public.lancamentos l on l.empresa_id = e.id
group by e.id, e.nome, extract(year from coalesce(l.data, current_date))::integer;
grant select on public.v_resumo_dre to authenticated;

create or replace view public.pessoas_dashboard as
select
  (select count(*) from public.pessoas_colaboradores where ativo) as colaboradores_ativos,
  (select count(*) from public.pessoas_pdis where status in ('aberto','em_andamento')) as pdis_abertos,
  (select count(*) from public.pessoas_okrs where status = 'em_andamento') as okrs_em_andamento,
  (select count(*) from public.pessoas_one_on_ones where data >= current_date - interval '30 days') as one_on_ones_30d,
  (select count(*) from public.pessoas_rotina_rua where data >= current_date - interval '30 days') as visitas_30d;
grant select on public.pessoas_dashboard to authenticated;

create or replace view public.rebate_clientes_stone as
select
  l.id::integer as empresa_id,
  to_char(l.mes_referencia, 'YYYY-MM-DD') as mes_referencia,
  coalesce(l.stonecode, '') as stonecode,
  l.nome_cliente as nome_fantasia,
  l.cidade,
  null::text as vendedor,
  null::text as polo,
  l.status_conciliacao as status,
  l.canal as canal_venda,
  null::date as data_credenciamento,
  l.tpv as tpv_estimado,
  l.tpv as tpv_m0,
  l.mdr as rec_mdr,
  l.antecipacao as rec_rav,
  0::numeric as rec_banking,
  0::numeric as rec_adesao,
  l.rebate_valor as lucro_bruto,
  null::text as vendedor_canonico,
  null::text as tipo_vendedor,
  null::text as formato
from public.stone_rebate_linhas l;
grant select on public.rebate_clientes_stone to authenticated;

create or replace view public.v_cliente_lifetime as
select stonecode, max(nome_cliente) as nome_fantasia, max(cidade) as cidade, null::text as vendedor_atual,
  count(distinct mes_referencia)::integer as meses_ativo, min(mes_referencia)::text as desde, max(mes_referencia)::text as ultimo_mes,
  coalesce(sum(rebate_valor),0)::numeric as lucro_total, coalesce(sum(mdr),0)::numeric as total_mdr,
  coalesce(sum(antecipacao),0)::numeric as total_rav, 0::numeric as total_banking, 0::numeric as total_adesao,
  coalesce(sum(tpv),0)::numeric as tpv_total, coalesce(avg(rebate_valor),0)::numeric as lucro_medio_mes, false as provavel_churn
from public.stone_rebate_linhas group by stonecode;
grant select on public.v_cliente_lifetime to authenticated;

create or replace view public.v_ranking_vendedor as
select 'Sem vendedor'::text as vendedor_canonico, null::text as tipo_vendedor, 0::integer as clientes_unicos, 0::integer as meses_total,
  null::text as desde, null::text as ate, 0::numeric as lucro_total, 0::numeric as lucro_medio_por_cliente_mes, 0::numeric as lucro_ult_6m;
grant select on public.v_ranking_vendedor to authenticated;

create or replace view public.v_evolucao_mensal as
select to_char(mes_referencia, 'YYYY-MM-DD') as mes_referencia, count(distinct stonecode)::integer as clientes_ativos,
  0::integer as vendedores_bj7_ativos, coalesce(sum(rebate_valor),0)::numeric as lucro_bruto,
  coalesce(sum(mdr),0)::numeric as rec_mdr, coalesce(sum(antecipacao),0)::numeric as rec_rav,
  0::numeric as rec_banking, 0::numeric as rec_adesao, coalesce(sum(tpv),0)::numeric as tpv_m0,
  coalesce(sum(rebate_valor),0)::numeric as lucro_bj7, 0::numeric as lucro_stone_matriz
from public.stone_rebate_linhas group by mes_referencia;
grant select on public.v_evolucao_mensal to authenticated;

create or replace function public.concluir_tarefa(_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.tarefas set status = 'concluida', concluida_em = now() where id = _id;
end;
$$;
grant execute on function public.concluir_tarefa(bigint) to authenticated;
