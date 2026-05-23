-- Tabela de conexões Open Finance (Pluggy) por empresa
-- Rodar no SQL Editor do Supabase (projeto fcalhtuolxxeijxnquqj)

CREATE TABLE IF NOT EXISTS openfinance_connections (
  id                  BIGSERIAL PRIMARY KEY,
  empresa_id          INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pluggy_item_id      TEXT    NOT NULL UNIQUE,   -- ID do item no Pluggy (chave do upsert)
  pluggy_connector_id INTEGER,                   -- ID numérico do banco/instituição
  connector_name      TEXT,                      -- Ex: "Nubank", "Itaú"
  status              TEXT    DEFAULT 'UPDATED', -- UPDATED | UPDATING | ERROR | OUTDATED | WAITING_USER_INPUT | LOGIN_ERROR
  consent_expires_at  TIMESTAMPTZ,               -- Validade do consentimento Open Finance
  last_sync_at        TIMESTAMPTZ,               -- Último disparo de sync
  last_sync_status    TEXT,                      -- Status retornado pelo Pluggy no último sync
  last_error          TEXT,                      -- Mensagem de erro quando status = ERROR
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openfinance_connections_empresa
  ON openfinance_connections (empresa_id);

-- RLS: só usuários autenticados leem; Service Role escreve via Edge Functions
ALTER TABLE openfinance_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler conexões"
  ON openfinance_connections
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE feitos apenas pela service role key (Edge Functions)
-- Nenhuma policy de escrita para 'authenticated' é criada intencionalmente.
