-- Phase 1 — campos cadastrais e flag "ativa" em public.empresas
-- Idempotente: todas colunas criadas com IF NOT EXISTS.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS razao_social         text,
  ADD COLUMN IF NOT EXISTS cnpj                 text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual   text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal  text,
  ADD COLUMN IF NOT EXISTS endereco_rua         text,
  ADD COLUMN IF NOT EXISTS endereco_numero      text,
  ADD COLUMN IF NOT EXISTS endereco_bairro      text,
  ADD COLUMN IF NOT EXISTS endereco_cidade      text,
  ADD COLUMN IF NOT EXISTS endereco_uf          text,
  ADD COLUMN IF NOT EXISTS endereco_cep         text,
  ADD COLUMN IF NOT EXISTS telefone             text,
  ADD COLUMN IF NOT EXISTS email_principal      text,
  ADD COLUMN IF NOT EXISTS contato_nome         text,
  ADD COLUMN IF NOT EXISTS contato_cargo        text,
  ADD COLUMN IF NOT EXISTS ativa                boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inativada_em         timestamptz,
  ADD COLUMN IF NOT EXISTS inativada_motivo     text;

-- Índice leve para listas operacionais filtrarem por status
CREATE INDEX IF NOT EXISTS empresas_ativa_idx ON public.empresas (ativa);
