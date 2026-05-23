# ENVIRONMENT — BJ7 Central

## Rodando localmente

```bash
# Instalar dependências
bun install

# Rodar em modo desenvolvimento (hot-reload)
bun dev

# Build de produção
bun run build

# Preview do build
bun run preview
```

## Supabase

| Item | Valor |
|---|---|
| Project ID | `fcalhtuolxxeijxnquqj` |
| URL | `https://fcalhtuolxxeijxnquqj.supabase.co` |
| Region | (verificar no dashboard) |
| Anon key | Presente em `src/integrations/supabase/client.ts` — é chave pública, não é segredo |

### Schemas do banco

| Schema | Uso |
|---|---|
| `public` | Core: lancamentos, empresas, categorias, unidades, papeis, usuarios, etc. |
| `documentos` | Contratos e documentos — acessado via `supabase.schema("documentos")` |
| `fiscal` | Obrigações fiscais, pendências contábeis — via `supabase.schema("fiscal")` |

### Conexão direta ao banco

O projeto usa **Antigravity IDE** para execução de SQL via connection string direta. Não usar Supabase Studio para operações em massa — usar `BEGIN/COMMIT` e backups primeiro.

## Deploy

| Etapa | Como funciona |
|---|---|
| Builder | Lovable (`@lovable.dev/vite-tanstack-config`) — edições via chat ou IDE |
| CI/CD | GitHub → deploy automático via Lovable |
| Hosting | Cloudflare Workers (`wrangler.jsonc`) |
| Preview | `https://preview--bj7adm.lovable.app` |

## Stack de ferramentas

| Ferramenta | Uso |
|---|---|
| **Bun** | Package manager e runtime (substitui npm/node) |
| **Vite 7** | Build tool — não adicionar plugins que o Lovable já inclui |
| **TanStack Router** | File-based routing — `src/routes/` |
| **TanStack Query** | Cache e data fetching — `useQuery`, `useMutation` |
| **shadcn/ui** | Componentes base — adicionar via `components.json` |
| **Tailwind CSS 4** | Estilização |
| **Recharts** | Gráficos financeiros |
| **Pluggy** | Open Finance — `react-pluggy-connect` |

## Variáveis de ambiente

O projeto não usa `.env` com variáveis secretas — a chave Supabase é a chave pública `anon`. Se precisar de variáveis de ambiente adicionais (ex: Pluggy API key), use o dashboard do Cloudflare Workers ou Supabase Edge Functions.

## Estrutura de pastas

```
src/
├── routes/                 # Páginas (file-based routing)
│   ├── __root.tsx          # Layout raiz + meta tags + providers
│   ├── login.tsx           # Página pública
│   └── _authenticated/     # Páginas protegidas (requerem login)
├── components/
│   ├── bj7/                # Componentes específicos do BJ7 (PageShell, ItemDrawer...)
│   ├── layout/             # AuthLayout, sidebar
│   ├── financeiro/         # Análise, lançamentos, relatórios
│   ├── dashboard/          # Widgets do dashboard
│   ├── open-finance/       # Widget Pluggy Connect
│   └── ui/                 # shadcn/ui — não editar manualmente
├── integrations/supabase/
│   ├── client.ts           # Cliente Supabase (untyped, intencional)
│   ├── database.ts         # Tipos TypeScript do schema
│   └── db.ts               # Helpers tipados (from, asRows, paginateAll)
├── hooks/
│   ├── use-refs.ts         # Hooks de referência (useEmpresas, etc.)
│   └── use-mobile.tsx      # Detecção mobile
├── lib/
│   ├── utils.ts            # cn() e utilitários
│   └── permissions.ts      # CurrentUser e lógica de papel
└── contexts/
    └── auth-context.tsx    # AuthProvider e hook useAuth

supabase/                   # SQL — schema definitions
├── cockpit_schema.sql      # regras, alertas, tarefas, interacoes
├── documentos_storage.sql  # Schema documentos
├── empresas_cadastrais.sql # Schema empresas
├── fiscal/                 # Schema fiscal
├── motor_regras.sql        # 7 regras automáticas + executar_regras()
├── pessoas_schema.sql      # PDI, OKRs, 1:1, rotina de rua
└── policies.sql            # RLS policies
```

## Limitações conhecidas

- **PostgREST cap:** limita queries a 1000 rows por request silenciosamente. Usar `paginateAll()` de `db.ts` para períodos longos de dashboard.
- **Schemas adicionais:** `supabase.schema("documentos")` e `supabase.schema("fiscal")` não se beneficiam dos tipos do `Database` interface (client é `SupabaseClient` sem generic). Ver `EDGE_FUNCTIONS.md`.
- **Edge Functions Pluggy:** não versionadas no repo — ver `EDGE_FUNCTIONS.md`.
