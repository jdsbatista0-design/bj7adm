-- PARTE A — Ampliar tabela public.itens e criar view de calendário unificado
-- Idempotente: usa IF NOT EXISTS / OR REPLACE em tudo.

-- A.1 — Novas colunas em public.itens
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'TAREFA' CHECK (tipo IN ('TAREFA','DECISAO','IDEIA','PROJETO','REUNIAO','LEMBRETE','NOTA'));
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS eixo_bj7 TEXT CHECK (eixo_bj7 IN ('VISAO','SISTEMA','PESSOAS','RESULTADOS','CULTURA_SER'));
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES public.empresas(id);
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS importante BOOLEAN DEFAULT FALSE;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS urgente BOOLEAN DEFAULT FALSE;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS energia TEXT CHECK (energia IN ('ALTA','MEDIA','BAIXA'));
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS contexto TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'BACKLOG' CHECK (estado IN ('BACKLOG','SEMANA','HOJE','EM_ANDAMENTO','BLOQUEADO','CONCLUIDO','ARQUIVADO'));
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS prazo DATE;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS data_reuniao TIMESTAMPTZ;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS duracao_min INTEGER;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS participantes TEXT[];
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS local_reuniao TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS opcoes_decisao JSONB;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS decisao_tomada TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS decisao_em DATE;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS item_pai_id INTEGER REFERENCES public.itens(id);
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS recorrencia TEXT CHECK (recorrencia IN ('DIARIA','SEMANAL','MENSAL','TRIMESTRAL','ANUAL'));

CREATE INDEX IF NOT EXISTS idx_itens_estado ON public.itens(estado);
CREATE INDEX IF NOT EXISTS idx_itens_tipo ON public.itens(tipo);
CREATE INDEX IF NOT EXISTS idx_itens_prazo ON public.itens(prazo) WHERE prazo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_itens_data_reuniao ON public.itens(data_reuniao) WHERE data_reuniao IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_itens_eixo ON public.itens(eixo_bj7);

-- A.2 — View unificada de calendário
CREATE OR REPLACE VIEW public.v_calendario_unificado AS
-- Obrigações fiscais
SELECT
  'FISCAL'::TEXT AS origem,
  o.id::TEXT AS source_id,
  o.vencimento AS data,
  NULL::TIME AS hora,
  t.nome AS titulo,
  e.nome AS contexto_extra,
  o.empresa_id,
  e.nome AS empresa_nome,
  o.status,
  o.valor_devido AS valor,
  CASE
    WHEN o.vencimento < CURRENT_DATE AND o.status NOT IN ('CUMPRIDA','DISPENSADA') THEN 'ATRASADO'
    WHEN o.vencimento <= CURRENT_DATE + 7 AND o.status NOT IN ('CUMPRIDA','DISPENSADA') THEN 'URGENTE'
    ELSE 'OK'
  END AS criticidade,
  '/fiscal/calendario' AS link_modulo
FROM fiscal.obrigacoes_calendario o
JOIN fiscal.tipos_obrigacao t ON t.id = o.tipo_obrigacao_id
LEFT JOIN public.empresas e ON e.id = o.empresa_id
WHERE o.status NOT IN ('CUMPRIDA','DISPENSADA')

UNION ALL
-- Itens com prazo
SELECT
  'COCKPIT'::TEXT,
  i.id::TEXT,
  i.prazo,
  NULL::TIME,
  i.titulo,
  i.tipo,
  i.empresa_id,
  e.nome,
  i.estado,
  NULL::NUMERIC,
  CASE
    WHEN i.prazo < CURRENT_DATE AND i.estado NOT IN ('CONCLUIDO','ARQUIVADO') THEN 'ATRASADO'
    WHEN i.prazo <= CURRENT_DATE + 3 AND i.estado NOT IN ('CONCLUIDO','ARQUIVADO') THEN 'URGENTE'
    ELSE 'OK'
  END,
  '/itens'
FROM public.itens i
LEFT JOIN public.empresas e ON e.id = i.empresa_id
WHERE i.prazo IS NOT NULL AND i.estado NOT IN ('CONCLUIDO','ARQUIVADO')

UNION ALL
-- Reuniões (itens tipo REUNIAO)
SELECT
  'REUNIAO'::TEXT,
  i.id::TEXT,
  i.data_reuniao::DATE,
  i.data_reuniao::TIME,
  i.titulo,
  COALESCE(i.local_reuniao, 'Reunião'),
  i.empresa_id,
  e.nome,
  i.estado,
  NULL::NUMERIC,
  CASE
    WHEN i.data_reuniao::DATE < CURRENT_DATE AND i.estado != 'CONCLUIDO' THEN 'ATRASADO'
    WHEN i.data_reuniao::DATE = CURRENT_DATE THEN 'URGENTE'
    ELSE 'OK'
  END,
  '/itens'
FROM public.itens i
LEFT JOIN public.empresas e ON e.id = i.empresa_id
WHERE i.tipo = 'REUNIAO' AND i.data_reuniao IS NOT NULL AND i.estado NOT IN ('ARQUIVADO')

UNION ALL
-- Visitas planejadas (rotina de rua)
SELECT
  'RUA'::TEXT,
  v.id::TEXT,
  v.data_planejada,
  v.hora_planejada,
  COALESCE(v.objetivo, tv.nome),
  tv.nome,
  v.empresa_id,
  e.nome,
  v.status,
  NULL::NUMERIC,
  CASE
    WHEN v.data_planejada < CURRENT_DATE AND v.status = 'PLANEJADA' THEN 'ATRASADO'
    WHEN v.data_planejada = CURRENT_DATE THEN 'URGENTE'
    ELSE 'OK'
  END,
  '/pessoas/rotina-rua'
FROM pessoas.visitas v
JOIN pessoas.tipos_visita tv ON tv.id = v.tipo_visita_id
LEFT JOIN public.empresas e ON e.id = v.empresa_id
WHERE v.data_planejada IS NOT NULL AND v.status IN ('PLANEJADA','EM_DESLOCAMENTO')

UNION ALL
-- Documentos vencendo
SELECT
  'DOCUMENTO'::TEXT,
  d.id::TEXT,
  d.vigencia_fim,
  NULL::TIME,
  'Vence: ' || d.titulo,
  t.nome,
  (SELECT de.empresa_id FROM documentos.documento_empresas de WHERE de.documento_id = d.id LIMIT 1),
  (SELECT e.nome FROM documentos.documento_empresas de JOIN public.empresas e ON e.id = de.empresa_id WHERE de.documento_id = d.id LIMIT 1),
  d.status,
  d.valor_total,
  CASE
    WHEN d.vigencia_fim < CURRENT_DATE THEN 'ATRASADO'
    WHEN d.vigencia_fim <= CURRENT_DATE + 7 THEN 'URGENTE'
    ELSE 'OK'
  END,
  '/documentos/vencimentos'
FROM documentos.documentos d
JOIN documentos.tipos t ON t.id = d.tipo_id
WHERE d.vigencia_fim IS NOT NULL AND d.status IN ('ATIVO','SUSPENSO')

UNION ALL
-- 1:1 agendados
SELECT
  'ONE_ON_ONE'::TEXT,
  oo.id::TEXT,
  oo.data_realizacao,
  NULL::TIME,
  '1:1: ' || g.nome || ' x ' || l.nome,
  COALESCE(oo.local, '1:1'),
  NULL::INTEGER,
  NULL::TEXT,
  oo.status,
  NULL::NUMERIC,
  CASE
    WHEN oo.data_realizacao < CURRENT_DATE AND oo.status = 'AGENDADO' THEN 'ATRASADO'
    WHEN oo.data_realizacao = CURRENT_DATE THEN 'URGENTE'
    ELSE 'OK'
  END,
  '/pessoas/one-on-ones'
FROM pessoas.one_on_ones oo
JOIN pessoas.pessoas g ON g.id = oo.gestor_pessoa_id
JOIN pessoas.pessoas l ON l.id = oo.liderado_pessoa_id
WHERE oo.status = 'AGENDADO';

GRANT SELECT ON public.v_calendario_unificado TO anon, authenticated, service_role;
