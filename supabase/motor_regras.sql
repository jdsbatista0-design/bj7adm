-- =====================================================================
-- BJ7 Central — Motor de regras (Fase 1)
-- Cole INTEIRO no SQL Editor APÓS cockpit_schema.sql.
-- Inclui: 7 regras seed + função executar_regras() chamada via RPC.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de upsert (idempotência por dedupe_key)
-- ---------------------------------------------------------------------

create or replace function public._inserir_alerta(
  _regra_id integer,
  _tipo text,
  _severidade text,
  _titulo text,
  _descricao text,
  _entidade_tipo text,
  _entidade_id text,
  _empresa_id integer,
  _payload jsonb,
  _dedupe_key text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alertas (
    regra_id, tipo, severidade, titulo, descricao,
    entidade_tipo, entidade_id, empresa_id, payload, dedupe_key
  ) values (
    _regra_id, _tipo, _severidade, _titulo, _descricao,
    _entidade_tipo, _entidade_id, _empresa_id, _payload, _dedupe_key
  )
  on conflict (dedupe_key) do update
    set descricao = excluded.descricao,
        payload   = excluded.payload,
        status    = case when public.alertas.status = 'resolvido' then 'aberto' else public.alertas.status end;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Regra 1: Lançamentos sem categoria há > 24h
-- ---------------------------------------------------------------------
create or replace function public._regra_sem_categoria(_regra public.regras)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer; v_emp record; v_n integer := 0;
begin
  for v_emp in
    select empresa_id, count(*) as qtd
      from public.lancamentos
     where categoria_id is null
       and criado_em < now() - interval '24 hours'
     group by empresa_id
     having count(*) > 0
  loop
    perform public._inserir_alerta(
      _regra.id, 'sem_categoria', _regra.severidade,
      v_emp.qtd || ' lançamentos sem categoria',
      'Há ' || v_emp.qtd || ' lançamentos sem categoria criados há mais de 24h. Categorize para melhorar relatórios.',
      'empresa', v_emp.empresa_id::text, v_emp.empresa_id,
      jsonb_build_object('quantidade', v_emp.qtd),
      'sem_categoria:' || v_emp.empresa_id || ':' || to_char(now(), 'YYYY-MM-DD')
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Regra 2: Categoria estourando (despesa > média 6m * fator)
-- ---------------------------------------------------------------------
create or replace function public._regra_categoria_estouro(_regra public.regras)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_fator numeric := coalesce((_regra.config->>'fator')::numeric, 1.3);
  v_min_meses integer := coalesce((_regra.config->>'min_meses')::integer, 3);
  v_n integer := 0;
  v_row record;
begin
  for v_row in
    with mes_atual as (
      select empresa_id, categoria_id, sum(valor) as total
        from public.lancamentos
       where tipo = 'Despesa'
         and date_trunc('month', data) = date_trunc('month', current_date)
         and categoria_id is not null
       group by empresa_id, categoria_id
    ),
    media_6m as (
      select empresa_id, categoria_id,
             avg(t) as media,
             count(*) as meses
        from (
          select empresa_id, categoria_id, date_trunc('month', data) as m, sum(valor) as t
            from public.lancamentos
           where tipo = 'Despesa'
             and data >= (current_date - interval '7 months')
             and data <  date_trunc('month', current_date)
             and categoria_id is not null
           group by empresa_id, categoria_id, date_trunc('month', data)
        ) x
       group by empresa_id, categoria_id
    )
    select m.empresa_id, m.categoria_id, m.total, h.media, h.meses,
           c.nome as categoria_nome, e.nome as empresa_nome
      from mes_atual m
      join media_6m h using (empresa_id, categoria_id)
      join public.categorias c on c.id = m.categoria_id
      join public.empresas e on e.id = m.empresa_id
     where h.meses >= v_min_meses
       and m.total > h.media * v_fator
  loop
    perform public._inserir_alerta(
      _regra.id, 'categoria_estouro', _regra.severidade,
      v_row.categoria_nome || ' estourou em ' || v_row.empresa_nome,
      'Gasto do mês: R$ ' || to_char(v_row.total, 'FM999G999G999D00') ||
      ' vs média 6m: R$ ' || to_char(v_row.media, 'FM999G999G999D00') ||
      ' (+' || to_char(((v_row.total / nullif(v_row.media,0)) - 1) * 100, 'FM999D0') || '%)',
      'categoria', v_row.categoria_id::text, v_row.empresa_id,
      jsonb_build_object('total', v_row.total, 'media', v_row.media, 'meses', v_row.meses),
      'categoria_estouro:' || v_row.empresa_id || ':' || v_row.categoria_id || ':' || to_char(current_date, 'YYYY-MM')
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Regra 3: Despesas duplicadas (mesma data + valor + descrição similar)
-- ---------------------------------------------------------------------
create or replace function public._regra_duplicidade(_regra public.regras)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; v_row record;
begin
  for v_row in
    select empresa_id, data, valor,
           lower(regexp_replace(coalesce(descricao,''), '\s+', ' ', 'g')) as desc_norm,
           array_agg(id order by id) as ids,
           count(*) as qtd
      from public.lancamentos
     where tipo = 'Despesa'
       and data >= current_date - interval '60 days'
     group by empresa_id, data, valor,
              lower(regexp_replace(coalesce(descricao,''), '\s+', ' ', 'g'))
     having count(*) > 1 and length(coalesce(lower(regexp_replace(coalesce(descricao,''), '\s+', ' ', 'g')),'')) > 3
  loop
    perform public._inserir_alerta(
      _regra.id, 'duplicidade', _regra.severidade,
      'Possível lançamento duplicado',
      v_row.qtd || ' lançamentos iguais em ' || to_char(v_row.data,'DD/MM/YYYY') ||
      ' — R$ ' || to_char(v_row.valor, 'FM999G999G999D00'),
      'lancamentos', array_to_string(v_row.ids, ','), v_row.empresa_id,
      jsonb_build_object('ids', v_row.ids, 'descricao', v_row.desc_norm),
      'duplicidade:' || v_row.empresa_id || ':' || md5(v_row.ids::text)
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Regra 4: Empresa sem receita há > N dias
-- ---------------------------------------------------------------------
create or replace function public._regra_receita_ausente(_regra public.regras)
returns integer language plpgsql security definer set search_path = public as $$
declare v_dias integer := coalesce((_regra.config->>'dias')::integer, 14);
        v_n integer := 0; v_row record;
begin
  for v_row in
    select e.id as empresa_id, e.nome,
           coalesce(max(l.data), '1900-01-01'::date) as ultima
      from public.empresas e
      left join public.lancamentos l on l.empresa_id = e.id and l.tipo = 'Receita'
     group by e.id, e.nome
    having coalesce(max(l.data), '1900-01-01'::date) < (current_date - make_interval(days => v_dias))
  loop
    perform public._inserir_alerta(
      _regra.id, 'receita_ausente', _regra.severidade,
      v_row.nome || ' sem receita há ' || (current_date - v_row.ultima) || ' dias',
      'Última receita registrada em ' || to_char(v_row.ultima, 'DD/MM/YYYY'),
      'empresa', v_row.empresa_id::text, v_row.empresa_id,
      jsonb_build_object('ultima', v_row.ultima),
      'receita_ausente:' || v_row.empresa_id || ':' || to_char(current_date, 'YYYY-MM-DD')
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Regra 5: Revisão atrasada (revisado=false há > N dias)
-- ---------------------------------------------------------------------
create or replace function public._regra_revisao_atrasada(_regra public.regras)
returns integer language plpgsql security definer set search_path = public as $$
declare v_dias integer := coalesce((_regra.config->>'dias')::integer, 3);
        v_count integer; v_n integer := 0;
begin
  select count(*) into v_count
    from public.lancamentos
   where revisado = false
     and criado_em < now() - make_interval(days => v_dias);
  if v_count > 0 then
    perform public._inserir_alerta(
      _regra.id, 'revisao_atrasada', _regra.severidade,
      v_count || ' lançamentos aguardando revisão',
      'Existem ' || v_count || ' lançamentos sem revisão criados há mais de ' || v_dias || ' dias.',
      'fila', 'revisao', null,
      jsonb_build_object('quantidade', v_count, 'dias', v_dias),
      'revisao_atrasada:' || to_char(current_date, 'YYYY-MM-DD')
    );
    v_n := 1;
  end if;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Regra 6: Importação parcial (linhas_ignoradas > 0)
-- ---------------------------------------------------------------------
create or replace function public._regra_importacao_parcial(_regra public.regras)
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; v_row record;
begin
  for v_row in
    select id, arquivo, linhas_ignoradas, data
      from public.importacoes
     where coalesce(linhas_ignoradas, 0) > 0
       and coalesce(data, current_timestamp) > now() - interval '30 days'
  loop
    perform public._inserir_alerta(
      _regra.id, 'importacao_parcial', _regra.severidade,
      'Importação com linhas ignoradas: ' || coalesce(v_row.arquivo, '#' || v_row.id),
      v_row.linhas_ignoradas || ' linhas ignoradas. Revise para evitar perda de dados.',
      'importacao', v_row.id::text, null,
      jsonb_build_object('arquivo', v_row.arquivo, 'ignoradas', v_row.linhas_ignoradas),
      'importacao_parcial:' || v_row.id
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Regra 7: Concentração de receita (top cliente Stone > X%)
-- (placeholder simples; refinar quando houver entidade `cliente`)
-- ---------------------------------------------------------------------
create or replace function public._regra_concentracao_receita(_regra public.regras)
returns integer language plpgsql security definer set search_path = public as $$
declare v_pct_max numeric := coalesce((_regra.config->>'pct_max')::numeric, 30);
        v_n integer := 0; v_row record;
begin
  for v_row in
    with totais as (
      select tomador, sum(valor) as t
        from public.notas_fiscais
       where data >= date_trunc('month', current_date) - interval '3 months'
         and tomador is not null
       group by tomador
    ),
    ranked as (
      select tomador, t, t / nullif(sum(t) over (), 0) * 100 as pct
        from totais
    )
    select * from ranked where pct > v_pct_max order by pct desc limit 5
  loop
    perform public._inserir_alerta(
      _regra.id, 'concentracao_receita', _regra.severidade,
      'Concentração: ' || v_row.tomador || ' = ' || to_char(v_row.pct, 'FM990D0') || '% da receita',
      'Risco de dependência de cliente único. Diversifique a base.',
      'cliente', v_row.tomador, null,
      jsonb_build_object('pct', v_row.pct, 'valor', v_row.t),
      'concentracao:' || md5(v_row.tomador) || ':' || to_char(current_date, 'YYYY-MM')
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Orquestrador: executa todas as regras ativas
-- ---------------------------------------------------------------------
create or replace function public.executar_regras()
returns table(regra_id integer, alertas integer, erro text)
language plpgsql security definer set search_path = public as $$
declare r public.regras; v_count integer; v_t0 timestamptz; v_dur integer; v_err text;
begin
  for r in select * from public.regras where ativo = true order by id loop
    v_t0 := clock_timestamp();
    v_count := 0;
    v_err := null;
    begin
      v_count := case r.tipo
        when 'categoria'   then public._regra_sem_categoria(r)
        when 'limite'      then public._regra_categoria_estouro(r)
        when 'duplicidade' then public._regra_duplicidade(r)
        when 'sla'         then public._regra_revisao_atrasada(r)
        when 'importacao'  then public._regra_importacao_parcial(r)
        when 'projecao'    then public._regra_concentracao_receita(r)
        when 'anomalia'    then public._regra_receita_ausente(r)
        else 0
      end;
    exception when others then
      v_err := SQLERRM;
    end;
    v_dur := extract(milliseconds from (clock_timestamp() - v_t0))::int;
    insert into public.regra_execucoes (regra_id, alertas_criados, duracao_ms, erro)
      values (r.id, v_count, v_dur, v_err);
    -- desfaz snooze que já passou
    update public.alertas set status = 'aberto'
     where status = 'snoozed' and snooze_ate is not null and snooze_ate <= now();

    regra_id := r.id; alertas := v_count; erro := v_err; return next;
  end loop;
end;
$$;
grant execute on function public.executar_regras() to authenticated;

-- ---------------------------------------------------------------------
-- Seed das 7 regras
-- ---------------------------------------------------------------------
insert into public.regras (nome, descricao, tipo, config, severidade, gera_tarefa) values
  ('Lançamentos sem categoria',     'Alerta quando há lançamentos sem categoria há mais de 24h.', 'categoria',   '{}'::jsonb, 'warn',     true),
  ('Categoria estourando',          'Despesa do mês > média dos últimos 6 meses × fator.',        'limite',      '{"fator":1.3,"min_meses":3}'::jsonb, 'critical', true),
  ('Despesas duplicadas',           'Mesmo valor, mesma data e descrição similar.',                'duplicidade', '{}'::jsonb, 'warn',     false),
  ('Revisão atrasada',              'Lançamentos não revisados há mais de N dias.',                'sla',         '{"dias":3}'::jsonb, 'warn',     true),
  ('Importação parcial',            'Importações com linhas ignoradas precisam revisão.',          'importacao',  '{}'::jsonb, 'warn',     true),
  ('Concentração de receita',       'Cliente único representando > X% da receita trimestral.',     'projecao',    '{"pct_max":30}'::jsonb, 'critical', false),
  ('Empresa sem receita',           'Empresa sem receita registrada há mais de N dias.',           'anomalia',    '{"dias":14}'::jsonb, 'critical', true)
on conflict do nothing;
