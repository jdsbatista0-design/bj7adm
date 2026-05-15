
# BJ7 Central — Redesign baseado no schema real

Auditei o banco (arquivos `supabase/*.sql` que o Claude criou). O redesign abaixo se ancora **só no que existe lá** — zero tabela inventada.

## O que o banco entrega hoje

**Domínio financeiro (base)**
`empresas`, `unidades`, `categorias` (com `tipo_predominante`, `grupo`), `lancamentos` (tipo, data, empresa, unidade, categoria, status, revisado, contar_no_total), `notas_fiscais`, `importacoes`.

**Stone**
`apuracao_rebate`, `evolucao_base_clientes`, `clientes_sumidos`.

**Cockpit (Claude)**
- `regras` (anomalia/limite/sla/duplicidade/categoria/projecao/importacao) + `regra_execucoes`
- `alertas` (severidade info/warn/critical, status aberto/ack/resolvido/snoozed, dedupe_key, empresa_id, entidade_tipo/id, payload jsonb)
- `tarefas` (prioridade, prazo, status, responsavel_id, empresa_id, origem manual/regra/alerta/sistema, alerta_id)
- `interacoes` (nota/whatsapp/email/sistema/ligacao/visita ligadas a entidade_tipo+id)
- `categoria_sugestoes` (hash_descricao → categoria_id, hits, score, origem humano/ia/regra)
- RPCs prontas: `ack_alerta`, `resolver_alerta`, `snooze_alerta`, `concluir_tarefa`, `executar_regras`

**Acesso**
`usuarios`, `papeis`, `usuario_empresas` + RLS via `current_user_can_see_empresa`, `current_user_can_see_tipo`, `current_user_perms`.

**Regras seed ativas (7)**: sem categoria, categoria estourando, duplicidade, receita ausente, revisão atrasada, importação parcial, concentração de receita.

## O que isso significa para a UI

O banco já modela o conceito “Item” via `tarefas` + `alertas`. CRM/contratos/AR-AP **não existem** — então a UI não inventa. Mostra estado vazio honesto e oferece criar como tarefa com `entidade_tipo='lead'|'contrato'|'cobranca'` (campo livre, indexável depois).

`interacoes` permite timeline/histórico em qualquer Item.
`categoria_sugestoes` permite autocomplete inteligente no lançamento.
RPCs do Claude resolvem todas as ações (ack, resolver, snooze, concluir).

## Telas — mapeamento direto banco → UI

| Rota | Fonte | Função |
|---|---|---|
| `/` Central | RPC nova `kpi_*` agregada + `alertas`+`tarefas` críticos + `lancamentos` agregado | Cockpit CEO: 5 KPIs grupo, "Exige atenção", "Hoje", "Dinheiro parado", grid Empresas com score |
| `/hoje` | `tarefas` (prazo<=hoje + atrasadas) + `alertas` aberto/ack | Inbox executivo do dia, ações inline (concluir/snooze/resolver) |
| `/comercial` | `tarefas where entidade_tipo in ('lead','oportunidade','proposta','followup')` | Kanban+lista. Vazio: explica + botão "criar primeiro lead como Item" |
| `/operacao` | `tarefas where entidade_tipo not in (comerciais)` ou null | Kanban por status, gargalos por responsável |
| `/financeiro` (tabs) | `lancamentos`, `categorias`, `notas_fiscais` | tabs: Visão (KPIs+breakdown atual), Razão, Lançar, Revisar |
| `/empresas` + `/empresas/$id` | `empresas` + tudo filtrado por empresa | Lista com score; detalhe com Saúde/Financeiro/Items/Stone(quando Stone) |
| `/inteligencia` | `regras`, `regra_execucoes`, `alertas`, `categoria_sugestoes` | Toggle regras, histórico execuções, "Rodar motor", sugestões IA |
| `/config` | `usuarios`, `papeis`, `categorias`, `regras`, `importacoes` | Reúne `/usuarios` e `/importacoes` atuais + CRUD categorias/regras |

Telas atuais (`/lancar`, `/razao`, `/a-revisar`, `/stone`, `/usuarios`, `/importacoes`) **continuam funcionando nas mesmas URLs** — viram alvos de links a partir do novo menu, sem renomear arquivos. A nova `/financeiro` agrega visualmente; as URLs antigas seguem válidas (sem 404, sem redirect, sem mexer em rotas).

## Sistema de design (frontend, sem mexer em backend)

Tokens em `src/styles.css` (oklch):
```
--background grafite, --surface chumbo, --foreground branco
--primary dourado champagne, --success verde, --danger vermelho
--warning âmbar, --info azul
--gradient-premium, --shadow-elegant
```
Sidebar shadcn `collapsible="icon"` desktop / Sheet no mobile. Header global com seletor de empresa (respeita `current_user_can_see_empresa`), botão "+ Item", busca.

**Componentes reutilizáveis novos** em `src/components/bj7/`:
`KpiCard`, `ItemCard`, `ItemList`, `ItemDrawer` (cria tarefa com `entidade_tipo` + opcional `empresa_id`), `EmpresaScoreCard`, `StatusBadge`, `SeveridadeBadge`, `PrioridadeBadge`, `EmptyState` didático, `SectionHeader`, `PageShell`, skeletons.

## Backend — adições mínimas

Um único arquivo novo: `supabase/kpis.sql` com RPCs SECURITY DEFINER agregadas (respeitam RLS via `current_user_*`):
- `kpi_saude_grupo()` → receita_mes, despesa_mes, margem, caixa_estimado, items_criticos, vs mês anterior
- `kpi_empresa_score(_empresa_id int)` → score 0–100 derivado de margem, % revisado, tarefas no prazo, alertas críticos
- `kpi_dinheiro_parado()` → soma de receitas com `status` aberto + lançamentos receita não revisados
- `kpi_hoje(_usuario_id int)` → tarefas+alertas do dia para o usuário
- `kpi_gargalos()` → top responsáveis por tarefas atrasadas

Nada toca: schema, RLS, policies, helpers, seed de regras, RPCs do Claude. Passo manual: rodar `kpis.sql` no SQL Editor.

## Ordem de execução

**Fase A (entrega já)**: tokens visuais + sidebar/PageShell + componentes base + Central + Hoje + ItemDrawer global. Reaproveita queries existentes.

**Fase B**: Comercial, Operação, Financeiro consolidado, Empresas (lista+detalhe), Inteligência, Configurações.

**Fase C**: `kpis.sql` no SQL Editor + ligar RPCs nos cards de Central/Empresas.

## Confirme antes de começar

1. **Fase A só**, te entrego pra ver, depois B e C — ok?
2. Manter URLs antigas válidas (sem renomear `/lancar`, `/razao`, etc.) — ok?
3. Sem novas tabelas; tipos de Item ficam em `tarefas.entidade_tipo` por enquanto — ok?
