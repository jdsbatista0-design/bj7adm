## Objetivo

Fechar o ciclo financeiro: toda conta paga vira um Lançamento (Despesa) no mesmo banco que alimenta o DRE; e ganhar visão clara de meses futuros (planejamento de caixa) e passados (histórico).

Sem alteração de schema — as colunas `contas_a_pagar.lancamento_id` e `contas_a_pagar.data_pagamento` já existem; só falta usá-las.

---

## 1. Pagar conta → criar Lançamento automaticamente

**Regra:** ao marcar uma conta como paga, inserir uma linha em `lancamentos` (tipo `Despesa`) e gravar o `id` resultante em `contas_a_pagar.lancamento_id`.

Mapeamento:

| `lancamentos` | vem de `contas_a_pagar` |
|---|---|
| `data` | `data_pagamento` |
| `ano` / `mes` | extraídos de `data_pagamento` |
| `tipo` | `"Despesa"` fixo |
| `empresa_id` | `empresa_id` da conta (obrigatório) |
| `categoria_id` | `categoria_id` da conta |
| `descricao` | `descricao` da conta + `(pago: <forma>)` |
| `valor` | `valor_pago` |
| `origem_classificacao` | `"contas_a_pagar"` |
| `contar_no_total` | `true` |
| `revisado` | `false` |

**Validação inteligente:** se a conta não tiver `empresa_id`, o botão "Marcar como pago" abre um pequeno popover pedindo empresa (e categoria sugerida) antes de prosseguir — sem empresa não existe Lançamento válido.

**Reversão:** desmarcar pagamento (ou excluir conta paga) deleta o `lancamento` vinculado pelo `lancamento_id` e zera o campo.

**Atualização do dialog "Nova conta":** quando o usuário cria uma conta com a switch "Já está paga" ligada, o mesmo fluxo roda para a 1ª parcela.

**Edição de conta já paga:** se valor / data_pagamento / empresa / categoria mudarem em uma conta com `lancamento_id`, atualizar o lançamento espelhado.

## 2. Indicador visual na tabela

- Nova coluna/badge "DRE" na linha: quando `lancamento_id != null`, mostrar chip verde "Lançada" com link para `/financeiro?ano=…&mes=…&q=<descricao>` (filtra o lançamento na aba de Lançamentos).
- Tooltip mostra `lancamento_id` e a data lançada.

## 3. Visão temporal (passado e futuro)

Substituir o filtro fixo "tabs A vencer / Atrasadas / Pagas / Todas" por um seletor de período mais rico, mantendo os tabs como filtros secundários de status:

**Barra de período (topo):**
- Botões: `← mês anterior`  `[Mês AAAA ▼]`  `próximo mês →`  `Hoje`
- Presets: `Próximos 30d` · `Próximos 90d` · `12 meses` · `Personalizado`
- Quando o período é maior que 1 mês, agrupa visualmente por mês na tabela.

**Mini-timeline (acima da tabela):**
- Barras mensais cobrindo 6 meses atrás → 6 meses à frente (configurável).
- Cada barra mostra total a vencer no mês; barras passadas pintam diferenciado (pagas vs atrasadas).
- Click numa barra → seta o período para aquele mês.
- Implementado com `recharts` (já usado no projeto).

**KPIs recalculados sobre o período selecionado:**
- A vencer · Atrasadas · Pagas · **Saldo previsto** (a vencer + atrasadas) — útil para planejar caixa.

## 4. Ajustes na query e KPIs

Query principal passa a aceitar `dataDe`/`dataAte` em vez de hard-code do dia de hoje. Status (`vencer`/`atrasadas`/`pagas`/`todas`) continua como filtro independente em cima do recorte de período.

## 5. Arquivos afetados

- **edit** `src/routes/_authenticated/financeiro.contas-a-pagar.tsx` — nova barra de período, mini-timeline, coluna DRE, query parametrizada, ações de pagar/estornar via novo helper.
- **new** `src/lib/contas-a-pagar.ts` — helpers puros:
  - `pagarConta(row, { dataPagamento, valorPago, empresaId?, categoriaId? })` → cria Lançamento + atualiza conta numa transação lógica (best-effort: insere lançamento, se OK atualiza conta; se a 2ª falha, faz rollback do lançamento).
  - `estornarPagamento(row)` → apaga lançamento e limpa flags.
  - `sincronizarLancamentoDeConta(row)` → atualização espelhada.
- **edit** `src/components/financeiro/ContaAPagarDialog.tsx` — usar `pagarConta` quando "Já paga" estiver ligado; exigir `empresa_id` se "Já paga" estiver marcada.
- **new** `src/components/financeiro/MarcarPagoPopover.tsx` — pequeno popover para confirmar data/valor/empresa antes de pagar.

## 6. Fora desta rodada

- Conciliação reversa (lançamento → conta a pagar).
- Recorrência de despesas direto na tabela `lancamentos`.
- Aprovação multi-etapa antes de lançar.
- Edição de Lançamento abrindo conta vinculada (ida-e-volta) — só o link de navegação será adicionado.

---

## Detalhes técnicos

- Todas as inserções em `lancamentos` usam o cliente browser autenticado (RLS aplica). Não precisa de server function.
- Origem `"contas_a_pagar"` em `origem_classificacao` permite filtrar/desfazer lote.
- `crypto.randomUUID()` continua para `grupo_id` de parcelas; o lançamento gerado não usa grupo.
- A timeline é puramente client-side: uma única query do range completo + `group by month` em JS.
- Sem migration. Sem novas dependências.
