# BJ7 Central

> Plataforma de gestão financeira multi-empresa para o Grupo BJ7. Centraliza receita, despesa, margem e itens (tarefas, decisões, ideias, problemas, cobranças) das empresas do grupo numa única tela, com input manual e relatórios concisos.

**URL do produto:** preview via Lovable em `https://preview--bj7adm.lovable.app`
**Banco:** Supabase (`fcalhtuolxxeijxnquqj.supabase.co`)
**Stack:** React 19 + TanStack Router/Query + Supabase (Postgres + RLS) + TailwindCSS 4 + shadcn/ui + Recharts

---

## 1. O que é

BJ7 Central nasceu como um Business OS genérico e evoluiu, sprint a sprint, para um **painel financeiro multi-empresa** com foco claro: mostrar **o que cada empresa ganhou, o que gastou, qual a margem** e centralizar a gestão administrativa do dia a dia. Dados entram por importação CSV em lote ou input manual diretamente no app.

Empresas hoje no escopo: **BJ7 Stone** (franquia Stone do litoral PR), **Izi**, **BJ7 Mídia**, **Batista&Prendin**, **Grupo BJ7**, **Izi Casas**, **Izi Imóveis**.

---

## 2. Estado atual (2026-05-16)

### Telas em produção (sidebar)

| Rota | O que faz |
|---|---|
| `/` Dashboard | Visão consolidada do grupo. 4 KPIs (Receita, Despesa, Lucro, Margem), tabela ranqueada por empresa, gráfico de evolução 12 meses. Filtros: mês atual / mês anterior / 3m / 6m / 12m / ano atual / personalizado |
| `/empresas` | Lista de empresas com KPIs por card |
| `/empresas/$id` | DRE detalhada de até 13 linhas agrupada por grupo de categoria, KPIs do período, gráfico de evolução 12 meses |
| `/lancamentos` | Conta corrente: lista de lançamentos com saldo acumulado, cards de totais, gráficos por categoria e por mês conforme filtros. Botão "+ Novo Lançamento" e modal de gestão de Categorias |
| `/itens` | Kanban com 4 colunas (Aberta, Em andamento, Aguardando, Concluída). Drag-and-drop entre colunas. 5 tipos: Tarefa, Decisão, Ideia, Problema, Cobrança |
| `/relatorios` | BI completo: KPIs consolidados, evolução, top 10 categorias, mix por tipo, comparativo por empresa, drill-down |
| `/importacoes` | Upload de CSV com dedupe por hash. Histórico com inseridos/ignorados |
| `/config` | Configurações de conta e papel |

### Telas legadas (fora do menu, ainda acessíveis por URL)

- `/hoje`, `/comercial`, `/operacao`, `/financeiro` — vieram do Business OS original. Mantidas no repo mas fora do menu para não confundir. Removíveis em sprint futuro.
- `/inteligencia` — tela atual (motor de regras técnico). Será reformulada como **mini-BI de insights personalizáveis** em sprint dedicado.
- `/stone` — aba específica da Stone (Notas Fiscais, Evolução de base, Clientes sumidos, Rebate). Em pausa.
- `/a-revisar` — fila de itens marcados como `revisado=false`.
- `/usuarios` — administração de usuários e permissões.

---

## 3. Stack e arquitetura

```
React 19 + TanStack Router (file-based) + TanStack Query
TailwindCSS 4 + shadcn/ui + Lucide Icons
Recharts (gráficos)
Supabase (Postgres + Auth + RLS) — dono do schema
Deploy: Cloudflare (via Lovable). Lovable é o IDE colaborativo que abre PRs no GitHub
```

Decisões de arquitetura:

- **Schema é externo.** `database.ts` documenta as tabelas mas não migra. Alterações de schema são feitas no SQL Editor do Supabase, com SQL versionado em `supabase/`.
- **RLS no banco + permissões no front.** Defesa em camadas. Mesmo um ataque ao front não consegue ler dados não permitidos.
- **Idempotência.** Importações CSV usam hash por linha; alertas e tarefas geradas por regras têm `dedupe_key`.
- **`contar_no_total`.** Flag que separa "dado oficial do dashboard" de "dado registrado mas fora do show" — usada para marcar duplicações sem deletar.

---

## 4. Modelo de dados

Tabelas principais:

- **`empresas`** — CNPJs do grupo
- **`unidades`** — filiais/lojas/polos de cada empresa
- **`categorias`** — categorias de lançamento com campo `grupo` (16 grupos de DRE)
- **`lancamentos`** — fato principal: `data`, `valor`, `tipo` (Receita/Despesa/Retirada/Empréstimo), `categoria_id`, `empresa_id`, `contar_no_total`, `hash_origem`
- **`tarefas`** — itens (5 tipos via `entidade_tipo`), com `status`, `prioridade`, `prazo`, `empresa_id`
- **`alertas`** — saídas do motor de regras
- **`regras`** — definições do motor
- **`usuarios`** + **`papeis`** + **`usuario_empresas`** — autenticação, autorização e escopo por empresa

### Grupos de DRE (campo `categorias.grupo`)

Páginas `/empresas/$id` e `/relatorios` agregam pelos 16 grupos, nesta ordem:

```
Receitas:           receita_bruta, receita_locacao
Impostos:           desp_impostos
Pessoal:            desp_pessoal, desp_pessoal_terceiro, desp_comissao
Operacionais:       desp_beneficios_veiculo, desp_aluguel, desp_utilities,
                    desp_administrativa, desp_servicos, desp_marketing, desp_seguranca
Financeiras:        desp_financeira
A revisar:          desp_nao_classificada
Investimento:       investimento_capex
Fora da DRE:        fora_dre_retirada, fora_dre_emprestimo
```

---

## 5. Permissões e papéis

| Papel | Vê faturamento | Vê retiradas | Vê todas empresas | Pode marcar revisado | Pode gerir usuários |
|---|---|---|---|---|---|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sócio | ✅ | ✅ | ✅ (config) | ✅ | ❌ |
| Gestor | ⚙️ | ❌ | ❌ (vínculo `usuario_empresas`) | ⚙️ | ❌ |

RLS aplica as regras no banco. Políticas em `supabase/policies.sql`. As páginas do front respeitam as mesmas flags em `public.usuarios`.

---

## 6. Limpezas e operações de banco

Operações já executadas:

- **2026-05-16 — Deduplicação:** 797 lançamentos (R$ 1.390.667,00) marcados com `contar_no_total = false`. Causa: reimportações de CSVs com sobreposição de períodos. Backup em `_backup_dedupe_2026_05_16`. Reversível.
- **2026-05-16 — Normalização de categorias:** 29 categorias mapeadas para 16 grupos de DRE. Backup em `_backup_categorias_2026_05_16`. Categoria com encoding corrompido (id 31) foi mesclada com a equivalente (id 26) e a duplicata apagada.

### Pendências conhecidas

- **2.861 lançamentos em "NÃO CLASSIFICADO"** (R$ 2,9 mi). Segunda maior categoria de despesa. Alvo da tela `/saude-dos-dados` no Sprint 5.
- **~50 lançamentos de OBRA parcelados no cartão** com data toda no mês da compra. Inflam o mês inicial e zeram os meses seguintes. Limpeza prevista no Sprint 7.
- **476 lançamentos antigos com `contar_no_total = false`** anteriores a 16/05. Não estão afetando relatórios, mas origem é desconhecida.

---

## 7. Roadmap

### Concluído

- ✅ **Sprint 1** — Fundação de dados: deduplicação, normalização em 16 grupos, encoding
- ✅ **Sprint 2** — Lançamentos (conta corrente) + DRE detalhada por empresa + view `dre_view`
- ✅ **Sprint 3** — Relatórios (BI completo) + view `dre_consolidada` + fix de período personalizado + cores semânticas
- ✅ **Sprint 4** — Sistema de Itens (Kanban drag-and-drop, 5 tipos, filtros) + modal de gestão de Categorias com detecção de similaridade (Levenshtein)

### Em planejamento

- 📋 **Sprint 5 — Saúde dos Dados:** rota `/saude-dos-dados` com diagnósticos automáticos. Tela de reclassificação em massa para atacar os 2.861 NÃO CLASSIFICADOS. Cron rodando motor de regras.
- 📋 **Sprint 6 — Inteligência v1:** `/inteligencia` redesenhada como mini-BI customizável. 8 widgets (variação anormal, tendência, concentração, comparação, margem em risco, top movimentos, anomalias, sazonalidade) com persistência de preferências por usuário.
- 📋 **Sprint 7 — Parcelamento de cartão:** ajustar `data` dos lançamentos OBRA para refletir mês real da parcela.
- 📋 **Sprint 8 — Refinamentos:** remover rotas órfãs, polir UI, atalhos de lançamento rápido.

---

## 8. Setup local

```bash
# Pré-requisitos: Node 20+, npm 10+
git clone https://github.com/jdsbatista0-design/bj7adm.git
cd bj7adm
npm install

# Criar .env.local com:
# VITE_SUPABASE_URL=...
# VITE_SUPABASE_PUBLISHABLE_KEY=...

npm run dev    # dev server
npm run build  # build de produção
```

> Alterações reais do app vão pelo Lovable (que abre PRs no `main`). Setup local é para auditoria, leitura e validação.

---

## 9. Roteiro de testes

### 9.1 Autenticação
- [ ] `/login` aceita credenciais e redireciona para `/`
- [ ] E-mail sem registro em `public.usuarios` mostra "Acesso não liberado"
- [ ] Logout limpa sessão

### 9.2 Permissões na sidebar
- [ ] **Admin** vê todas as 7 entradas
- [ ] **Sócio** com `ve_faturamento=false` não vê Receita no Dashboard nem na DRE
- [ ] **Gestor** sem `ve_todas_empresas` e sem vínculo tem dashboard vazio

### 9.3 Dashboard
- [ ] "Mês atual" mostra setas comparando ao mês anterior
- [ ] "Personalizado" com janela > 24 meses esconde setas e mostra hint "Janela longa demais para comparar"
- [ ] Click em empresa navega para `/empresas/$id`
- [ ] Gráfico 12m: verde (receita), vermelho (despesa), azul claro (lucro)

### 9.4 Empresa (DRE)
- [ ] DRE de até 13 linhas, agrupada por grupo
- [ ] Cada linha: valor, % sobre receita, variação vs período anterior
- [ ] Linha "Resultado Operacional" no fim
- [ ] Gráfico 12m da empresa

### 9.5 Lançamentos
- [ ] "+ Novo Lançamento" abre dialog
- [ ] Filtros atualizam URL e tabela
- [ ] Coluna "Saldo" mostra saldo acumulado conforme filtro
- [ ] Cards de totais refletem filtros
- [ ] Gráficos respondem aos filtros
- [ ] Modal "Categorias" permite criar/editar/excluir, detecta similares

### 9.6 Itens
- [ ] Kanban com 4 colunas
- [ ] Drag-and-drop atualiza status
- [ ] Filtros por empresa, prioridade, busca, "Meus / Todos"
- [ ] Indicador de "vencido" em vermelho

### 9.7 Relatórios
- [ ] KPIs consolidados
- [ ] Top 10 categorias
- [ ] Mix por tipo
- [ ] Evolução temporal
- [ ] Comparativo por empresa
- [ ] Drill-down em categoria abre dialog com detalhamento

### 9.8 Importações
- [ ] Upload de CSV correto cria importação
- [ ] **Teste de dedupe (crítico):** reimportar mesmo CSV → "0 novos · N ignorados"
- [ ] Erros listam linhas inválidas
- [ ] Histórico exibe importações

### 9.9 RLS direto no banco
- [ ] Gestor sem `ve_faturamento` não consegue `SELECT` em `lancamentos` com `tipo='Receita'`
- [ ] Gestor sem vínculo em `usuario_empresas` tem listas vazias
- [ ] `UPDATE` em lançamento `revisado=true` falha para Gestor

### 9.10 KPIs de referência
Como Admin, "todos os anos", "todas empresas", após limpezas de 16/05/2026:
- Receita histórica: **~R$ 14,9 mi**
- Despesa histórica: **~R$ 17,4 mi**
- Lucro do grupo: **negativo no acumulado** — reflete CAPEX de OBRA (R$ 4,5 mi) contabilizado como despesa. Leitura correta da saúde operacional é pela DRE mensal de cada empresa, não pelo somatório histórico.

---

## 10. Manutenção

### Diagnóstico rápido (SQL Editor, semanal)

```sql
SELECT
  (SELECT COUNT(*) FROM lancamentos WHERE contar_no_total = true) AS lanc_validos,
  (SELECT COUNT(*) FROM lancamentos WHERE categoria_id IS NULL) AS sem_categoria,
  (SELECT COUNT(*) FROM categorias WHERE grupo IS NULL OR grupo = '') AS cat_sem_grupo,
  (SELECT COUNT(*) FROM tarefas WHERE status IN ('aberta','em_andamento')) AS itens_abertos,
  (SELECT COUNT(*) FROM alertas WHERE status = 'aberto') AS alertas_pendentes;
```

### Diagnóstico de duplicação suspeita

```sql
-- Lançamentos com mesmo empresa+data+valor+descrição+categoria (potencial duplicação)
SELECT empresa_id, data, valor, descricao, COUNT(*) AS n
FROM lancamentos
WHERE contar_no_total = true AND tipo IN ('Receita', 'Despesa')
GROUP BY empresa_id, data, valor, descricao, categoria_id
HAVING COUNT(*) > 1
ORDER BY n DESC LIMIT 30;
```

### Backups disponíveis

- `_backup_dedupe_2026_05_16` — 797 ids marcados como duplicados em 16/05
- `_backup_categorias_2026_05_16` — snapshot das 29 categorias antes da normalização

### Motor de regras

`supabase/motor_regras.sql` contém 7 regras (categoria estourando, despesas duplicadas, revisão atrasada, importação parcial, concentração de receita, empresa sem receita há > 14 dias, lançamento sem categoria). RPC `executar_regras()` roda e popula `alertas`. **Ainda não roda automaticamente.** Ativar via Supabase Scheduled Functions é parte do Sprint 5.

---

## 11. Convenções

- **Datas no banco:** `date` em UTC. Front converte com `toLocalIsoDate` em `src/lib/format.ts`.
- **Valores:** sempre `numeric(14,2)`. Display via `formatBRL`.
- **Permissões:** `src/lib/permissions.ts` é a fonte única da verdade.
- **Estilo:** shadcn/ui + Tailwind. Cores via tokens (`--success`, `--destructive`, `--warning`, `--primary`). Evitar hex hardcoded.
- **Estado:** TanStack Query para tudo que vem do banco. Não usar Context para dados.

---

## 12. Histórico de versões

| Data | Versão | Marco |
|---|---|---|
| 2026-05-14 | 0.1 | Importação histórica concluída (12 arquivos, 4107 lançamentos) |
| 2026-05-15 | 0.2 | Sidebar enxuta, Dashboard refeito (multi-empresa) |
| 2026-05-16 | 0.3 | Limpeza de duplicação (R$ 1,39 mi), normalização em 16 grupos, DRE detalhada, Relatórios BI, Itens (Kanban), gestão de Categorias |
| (próximo) | 0.4 | Saúde dos Dados + reclassificação em massa |
| (próximo) | 0.5 | Inteligência v1 customizável |

---

*Última atualização: 2026-05-16*
