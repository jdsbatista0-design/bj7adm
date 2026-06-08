## Diagnóstico do banco (já conferido)

Todas as tabelas da Fase 1 já existem no `public` — **nenhuma migration necessária**:

| Tabela | Status | Observação |
|---|---|---|
| `tarefas` | ✅ existe | Schema enxuto: `titulo, descricao, prioridade, prazo, status, entidade_tipo/id, empresa_id, origem, responsavel_id, dedupe_key` |
| `contas_a_pagar` | ✅ existe | Schema completo (recorrência, grupo_id, lancamento_id, pago, valor_pago) |
| `obrigacoes_fiscais` | ✅ existe | `tipo, competencia, vencimento, valor, status, guia_url` |
| `notas_rapidas` | ✅ existe | `conteudo, tipo, fixada, arquivada` |
| `juridico_processos` | ✅ existe | (entra na Fase 2) |
| `mkt_campanhas` | ✅ existe | (entra na Fase 2) |
| views DRE | ✅ `dre_consolidada`, `dre_operacional`, `v_resumo_dre` | DRE Consolidado já aponta para `dre_operacional` |

**Problemas detectados em rotas atuais:**
- **Cockpit `/itens`** consulta tabela `itens` que **não existe no public** (só `tarefas`). Resultado: tela quebra ou volta vazia.
- **Fiscal Dashboard** consulta views `v_dashboard`, `v_monitoramento_simples`, `v_calendario_proximo` que não estão no `public` — precisam vir do schema `fiscal` (já usado em outros pontos com `supabase.schema("fiscal")`).
- **DRE Consolidado** aponta correto, mas precisa de smoke test.
- **Configurações** tem só 3 cards — falta surfacing dos novos módulos.

---

## Escopo desta rodada (Fase 1)

### 1. Cockpit — reescrever contra `tarefas`
Rota `/itens` hoje espera campos que não existem (`eixo_bj7`, `importante`, `urgente`, `energia`, `estado`, etc.). Vou reescrever o Cockpit para usar o schema real da `tarefas`:

- **Colunas Kanban** por `status`: `aberta`, `em_andamento`, `bloqueada`, `concluida` (lendo o que existir e agrupando "outros" no fim).
- **Filtros**: empresa, prioridade (alta/media/baixa), responsável, origem, busca por título/descrição.
- **Card**: título, prioridade (badge), prazo (com destaque vermelho se atrasado), origem, empresa, entidade vinculada.
- **Ações**: criar nova (drawer), editar inline (drawer), concluir (`status='concluida'` + `concluida_em=now()`), reabrir, excluir.
- **CTA "Hoje"**: filtro rápido por `prazo <= hoje AND status != 'concluida'`.
- Reaproveita `ItemCard` e `ItemDrawer` existentes mas tipados em `TarefaRow` (que já existe em `database.ts`).

### 2. Contas a Pagar — nova rota `/financeiro/contas-a-pagar`
Página completa contra `contas_a_pagar`:

- **Tabs**: "A vencer" (`pago=false AND vencimento>=hoje`), "Atrasadas" (`pago=false AND vencimento<hoje`), "Pagas" (`pago=true`), "Todas".
- **Filtro por período** (mesmo padrão de Lançamentos), **empresa**, **categoria**, **recorrência**.
- **Tabela**: vencimento · descrição · empresa · categoria · valor · status (badge) · ações.
- **Ações**: marcar como pago (preenche `data_pagamento`, `valor_pago`, `pago=true`), editar, excluir.
- **Dialog de criação/edição**: descrição, valor, vencimento, empresa, categoria, recorrência (única, mensal, anual), observação.
- **Recorrência**: quando mensal/anual, ao criar gera N parcelas com o mesmo `grupo_id` (uuid) por até 12 meses à frente.
- **KPIs no topo**: total a vencer no mês, total atrasado, total pago no mês.

### 3. Obrigações Fiscais — nova rota `/fiscal/obrigacoes`
Página contra `obrigacoes_fiscais`:

- **Tabs**: "Próximas" (status pendente, vencimento próximo), "Vencidas", "Pagas".
- **Filtros**: empresa, tipo, competência (mês/ano).
- **Tabela**: vencimento · tipo · empresa · competência · valor · status · guia (link) · ações.
- **Ações**: marcar paga, editar, excluir, abrir guia (URL).
- **Dialog de criação**: tipo, descrição, competência, vencimento, valor, empresa, guia_url, observação.
- Atualiza link na sidebar (substitui ou adiciona ao lado de "Pendências Contábeis").

### 4. Notas Rápidas — drawer global (Inbox)
- Drawer aberto pelo FAB, listando `notas_rapidas` ordenadas por `fixada DESC, criado_em DESC` (arquivadas escondidas).
- Criar texto rápido com tipo (`nota`, `ideia`, `lembrete`).
- Fixar/desfixar, arquivar, excluir.

### 5. FAB global + bottom nav mobile
- **FAB** flutuante no canto inferior direito (componente novo em `src/components/bj7/Fab.tsx`) com menu de criação rápida:
  - Nova tarefa (drawer Cockpit)
  - Nova conta a pagar
  - Nova obrigação fiscal
  - Nova nota rápida
  - Novo lançamento (reaproveita `LancamentoDialog`)
- **Bottom nav** apenas no mobile (`useIsMobile`): Início · Cockpit · Financeiro · Fiscal · Mais (abre sheet com o resto). Esconde quando teclado abre e quando FAB aberto. Padding inferior na `<main>` para não cobrir conteúdo.

### 6. Correção das rotas quebradas

| Rota | Correção |
|---|---|
| `/itens` (Cockpit) | Reescrever contra `tarefas` (item 1) |
| `/fiscal/dashboard` | Trocar `.from("v_dashboard")` → `supabase.schema("fiscal").from("v_dashboard")` (idem outras 2 views). Se as views não existirem em fiscal, calcular agregados client-side em cima de `obrigacoes_fiscais`. Faço fallback automático com try/catch. |
| `/financeiro/dre-consolidado` | Verificar render contra `dre_operacional` (já correta) — sem alteração de código a princípio. |
| `/config` | Adicionar cards para: Contas a Pagar, Obrigações Fiscais, Notas Rápidas, Cockpit. Manter cards atuais. |

### 7. Sidebar
- Adicionar no grupo **Financeiro**: "Contas a Pagar" (`/financeiro/contas-a-pagar`).
- Adicionar no grupo **Fiscal**: "Obrigações" (`/fiscal/obrigacoes`).
- Cockpit já existe no topo.

### 8. Tipos & helpers
- Estender `database.ts` com `ContaAPagarRow`, `ObrigacaoFiscalRow`, `NotaRapidaRow` (já feitos? confirmar — adicionar o que faltar).
- Adicionar essas tabelas ao `RowMap` em `db.ts`.

---

## Detalhes técnicos

- **Sem migrations** — todas as tabelas existem; usar exatamente os nomes/tipos retornados pelo schema.
- **RLS**: todas as tabelas novas já estão no banco — assumindo policies prontas. Se algum INSERT/SELECT retornar 401/403 em testes manuais, abrir como bug separado.
- **Padrões reutilizados**:
  - `PageShell` para wrapping de páginas
  - `ItemDrawer` / `LancamentoDialog` como base de novos drawers
  - `useEmpresas` / `useCategorias` para selects
  - Filtros de período do `LancamentosView`
- **Datas**: `date-fns` (já no projeto), `pointer-events-auto` no Calendar dentro de Popover.
- **Forms**: react-hook-form + zod (padrão atual).
- **Cache**: TanStack Query com `queryKey` por filtro; `invalidateQueries` após mutations.
- **Sem alterações em `_authenticated/route.tsx`** (integration-managed).
- **Sem novas server functions** — tudo client-side com `supabase` (browser client) seguindo o padrão atual do projeto.

---

## Arquivos previstos

**Novos:**
- `src/routes/_authenticated/financeiro.contas-a-pagar.tsx`
- `src/routes/_authenticated/fiscal.obrigacoes.tsx`
- `src/components/contas/ContaAPagarDialog.tsx`
- `src/components/fiscal/ObrigacaoFiscalDialog.tsx`
- `src/components/cockpit/TarefaDialog.tsx`
- `src/components/notas/NotasRapidasDrawer.tsx`
- `src/components/bj7/Fab.tsx`
- `src/components/layout/BottomNav.tsx`

**Editados:**
- `src/routes/_authenticated/itens.tsx` — reescrita contra `tarefas`
- `src/routes/_authenticated/fiscal.dashboard.tsx` — schema fiscal + fallback
- `src/routes/_authenticated/config.tsx` — novos cards
- `src/components/layout/AuthLayout.tsx` — sidebar + FAB + BottomNav
- `src/integrations/supabase/database.ts` e `db.ts` — tipos/RowMap

---

## Fora desta rodada (vai para Fase 2/3)

- Notas Fiscais (página dedicada além do que já existe)
- Jurídico (`/juridico`)
- Marketing (`/marketing`)
- Integração de calendário externo
- Frota, Projetos, Pontos de Mídia, busca global, notificações

## Testes

Conforme combinado, testes end-to-end (smoke + visual) **só ao final das 3 fases**. Nesta rodada vou validar apenas que o build limpa e as rotas novas montam sem erro no console (verificação rápida no preview).
