-- =====================================================================
-- BJ7 Central — Importação de Rebate Stone
-- Rodar UMA VEZ no SQL Editor do Cloud (Supabase).
-- =====================================================================

-- 1) Header das importações
CREATE TABLE IF NOT EXISTS public.stone_rebate_imports (
  id                bigserial PRIMARY KEY,
  arquivo_nome      text NOT NULL,
  arquivo_hash      text NOT NULL,
  usuario_id        bigint REFERENCES public.usuarios(id) ON DELETE SET NULL,
  empresa_id        bigint REFERENCES public.empresas(id) ON DELETE RESTRICT,
  periodo_inicio    date,
  periodo_fim       date,
  mes_referencia    date,                    -- 1º dia do mês
  status            text NOT NULL DEFAULT 'importado',
                    -- pendente | prevalidado | importado | revertido | erro
  total_linhas      integer NOT NULL DEFAULT 0,
  linhas_ok         integer NOT NULL DEFAULT 0,
  linhas_erro       integer NOT NULL DEFAULT 0,
  linhas_duplicadas integer NOT NULL DEFAULT 0,
  valor_total_rebate numeric(14,2) NOT NULL DEFAULT 0,
  conta_a_pagar_id  bigint REFERENCES public.contas_a_pagar(id) ON DELETE SET NULL,
  lancamento_id     bigint REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  observacao        text,
  mapeamento_json   jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS stone_rebate_imports_hash_uidx
  ON public.stone_rebate_imports (arquivo_hash)
  WHERE status <> 'revertido';

CREATE INDEX IF NOT EXISTS stone_rebate_imports_mes_idx
  ON public.stone_rebate_imports (mes_referencia DESC);

-- 2) Linhas (staging + histórico granular)
CREATE TABLE IF NOT EXISTS public.stone_rebate_linhas (
  id                bigserial PRIMARY KEY,
  import_id         bigint NOT NULL REFERENCES public.stone_rebate_imports(id) ON DELETE CASCADE,
  linha_num         integer NOT NULL,
  stonecode         text,
  documento         text,
  nome_cliente      text,
  data_referencia   date,
  mes_referencia    date,
  tpv               numeric(14,2),
  receita_bruta     numeric(14,2),
  rebate_valor      numeric(14,2),
  mdr               numeric(14,2),
  antecipacao       numeric(14,2),
  aluguel           numeric(14,2),
  produto           text,
  bandeira          text,
  canal             text,
  cidade            text,
  rota              text,
  status_conciliacao text NOT NULL DEFAULT 'ok',  -- ok | erro | duplicada
  erro_importacao   text,
  dados_originais_json jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stone_rebate_linhas_import_idx
  ON public.stone_rebate_linhas (import_id);
CREATE INDEX IF NOT EXISTS stone_rebate_linhas_stonecode_idx
  ON public.stone_rebate_linhas (stonecode);
CREATE INDEX IF NOT EXISTS stone_rebate_linhas_mes_idx
  ON public.stone_rebate_linhas (mes_referencia);

-- 3) GRANTs (PostgREST exige)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stone_rebate_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stone_rebate_linhas  TO authenticated;
GRANT ALL ON public.stone_rebate_imports TO service_role;
GRANT ALL ON public.stone_rebate_linhas  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.stone_rebate_imports_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.stone_rebate_linhas_id_seq  TO authenticated;

-- 4) RLS — qualquer usuário autenticado lê; só quem pode gerir usuários escreve
ALTER TABLE public.stone_rebate_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stone_rebate_linhas  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stone_rebate_imports_read  ON public.stone_rebate_imports;
DROP POLICY IF EXISTS stone_rebate_imports_write ON public.stone_rebate_imports;
DROP POLICY IF EXISTS stone_rebate_linhas_read   ON public.stone_rebate_linhas;
DROP POLICY IF EXISTS stone_rebate_linhas_write  ON public.stone_rebate_linhas;

CREATE POLICY stone_rebate_imports_read  ON public.stone_rebate_imports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY stone_rebate_imports_write ON public.stone_rebate_imports
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.papeis p ON p.id = u.papel_id
    WHERE u.auth_uid = auth.uid()::text AND p.pode_gerir_usuarios = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.papeis p ON p.id = u.papel_id
    WHERE u.auth_uid = auth.uid()::text AND p.pode_gerir_usuarios = true
  ));

CREATE POLICY stone_rebate_linhas_read   ON public.stone_rebate_linhas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY stone_rebate_linhas_write  ON public.stone_rebate_linhas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.papeis p ON p.id = u.papel_id
    WHERE u.auth_uid = auth.uid()::text AND p.pode_gerir_usuarios = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.papeis p ON p.id = u.papel_id
    WHERE u.auth_uid = auth.uid()::text AND p.pode_gerir_usuarios = true
  ));

-- 5) Categoria padrão de receita do rebate
INSERT INTO public.categorias (nome, tipo_predominante, grupo)
SELECT 'Receita Stone - Rebate', 'Receita', 'Receita Operacional'
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias WHERE nome = 'Receita Stone - Rebate'
);
