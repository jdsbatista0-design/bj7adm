# EDGE_FUNCTIONS — BJ7 Central

## Situação atual

O repositório **não contém** a pasta `supabase/functions/`. As Edge Functions existem no dashboard do Supabase mas não estão versionadas no git — isso é um risco: se o projeto for reimplantado do zero, as funções somem.

## Edge Functions do Pluggy (Open Finance)

A tela `/open-finance/conectar` chama 3 Edge Functions que precisam existir no Supabase:

### `pluggy-auth`
- **O que faz:** gera um `connect_token` temporário para o widget Pluggy Connect
- **Chamada no frontend:** `supabase.functions.invoke("pluggy-auth", { body: { empresa_id } })`
- **O que precisa:** a chave secreta da API Pluggy (nunca expor no frontend)
- **Retorna:** `{ connect_token: string }`

### `pluggy-sync`
- **O que faz:** dispara sincronização de transações de um item já conectado
- **Chamada no frontend:** `supabase.functions.invoke("pluggy-sync", { body: { item_id } })`
- **Retorna:** status da sincronização

### `pluggy-register-item`
- **O que faz:** salva a conexão bancária estabelecida pelo widget no banco de dados
- **Chamada no frontend:** `supabase.functions.invoke("pluggy-register-item", { body: { item_id, empresa_id, connector_name } })`
- **Problema:** a tabela que armazena os `pluggy_items` não foi encontrada no schema do repositório

## O que falta fazer

- [x] Criar a pasta `supabase/functions/` com o código das 3 funções
- [x] Criar tabela `openfinance_connections` — ver `supabase/openfinance_connections.sql`
- [ ] Rodar `supabase/openfinance_connections.sql` no SQL Editor do Supabase
- [ ] Adicionar `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` como secrets no Supabase:
  ```bash
  supabase secrets set PLUGGY_CLIENT_ID=... PLUGGY_CLIENT_SECRET=... --project-ref fcalhtuolxxeijxnquqj
  ```
- [ ] Deploy das 3 funções:
  ```bash
  supabase functions deploy pluggy-auth --project-ref fcalhtuolxxeijxnquqj
  supabase functions deploy pluggy-sync --project-ref fcalhtuolxxeijxnquqj
  supabase functions deploy pluggy-register-item --project-ref fcalhtuolxxeijxnquqj
  ```

### Tabela real: `openfinance_connections`

O frontend usa `openfinance_connections` (não `pluggy_items`). Schema em `supabase/openfinance_connections.sql`.

Coluna `pluggy_item_id` é a chave única — o upsert do `pluggy-register-item` usa ela como `onConflict`, então reconectar uma conta existente apenas atualiza o registro.

## Schemas adicionais (`documentos` e `fiscal`)

O cliente Supabase do projeto é `SupabaseClient` sem generic `Database<...>`. Isso é intencional (trade-off documentado em `client.ts`): evita conflito com o tipo do supabase-js v2.

**Consequência:** queries em schemas alternativos como `supabase.schema("documentos" as never)` e `supabase.schema("fiscal")` funcionam em runtime, mas não têm autocomplete de TypeScript.

**Alternativa futura:** se quiser tipagem completa dos schemas alternativos, criar um tipo `MultiSchemaDatabase` separado e instanciar um segundo client tipado apenas para esses schemas — sem alterar o client principal.

## Adicionando uma nova Edge Function ao repo

```bash
# Criar estrutura local
mkdir -p supabase/functions/nome-da-funcao
# Criar arquivo index.ts com Deno
# Fazer deploy via Supabase CLI
supabase functions deploy nome-da-funcao --project-ref fcalhtuolxxeijxnquqj
```
