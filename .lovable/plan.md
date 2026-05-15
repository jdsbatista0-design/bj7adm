## Fase 0 + 1 — Fundação invisível + Cockpit Financeiro Inteligente

Objetivo: trocar o sistema passivo por uma central que **detecta problemas, gera tarefas/alertas e cobra ação**, focada em Financeiro como primeiro domínio.

---

### Bloco A — Esquema de dados (migration única)

Novas tabelas em `public`, todas com RLS ligada e políticas via `has_role`/`usuarios.auth_uid`:

- `alertas` — id, tipo, severidade (info/warn/critical), titulo, descricao, entidade_tipo, entidade_id, empresa_id, payload jsonb, status (aberto/ack/resolvido/snoozed), snooze_ate, criado_em, ack_por, ack_em, resolvido_em, regra_id.
- `tarefas` — id, titulo, descricao, responsavel_id (usuarios.id), criado_por, prioridade (baixa/media/alta/urgente), prazo, status (aberta/em_andamento/aguardando/concluida/cancelada), entidade_tipo, entidade_id, empresa_id, origem (manual/regra/alerta), criada_em, concluida_em.
- `regras` — id, nome, descricao, tipo (anomalia/limite/sla/duplicidade/categoria/projecao), config jsonb (DSL leve: campo, operador, valor, janela_dias, agrupar_por…), severidade, gera_tarefa bool, ativo, criado_em.
- `regra_execucoes` — id, regra_id, executada_em, alertas_criados, duracao_ms, erro.
- `interacoes` — id, entidade_tipo, entidade_id, tipo (nota/whatsapp/email/sistema), conteudo, autor_id, criada_em. (Timeline cross-domínio; já entra para ser usada por Imobiliária/Stone depois.)
- `categoria_sugestoes` — id, hash_descricao, categoria_id, score, hits. (Cache de classificação automática.)

Índices nos campos quentes (`status`, `prazo`, `responsavel_id`, `entidade_tipo+entidade_id`, `empresa_id`).

---

### Bloco B — Motor de regras (server-side)

Server functions em `src/lib/motor.functions.ts`:

- `executarRegras()` — itera regras ativas, executa cada uma, grava em `regra_execucoes`, cria `alertas`/`tarefas`. Idempotente por chave determinística (regra_id + entidade + janela) para não duplicar alerta no mesmo ciclo.
- `executarRegra(regra_id)` — manual, para teste.
- Endpoint público autenticado por secret: `src/routes/api/public/cron-motor.ts` para disparo externo (pg_cron ou cron externo) chamando `executarRegras()`.

Regras seed (Financeiro) já com config pronta:

1. **Lançamento sem categoria > 24h** → alerta + tarefa "Categorizar X lançamentos".
2. **Categoria estourando** — gasto do mês > média dos últimos 6 meses × 1,3 → alerta crítico por categoria/empresa.
3. **Despesa duplicada** — mesma data + valor + descrição similar (hash) → alerta + sugestão de merge.
4. **Receita ausente** — empresa sem receita há > N dias úteis → alerta.
5. **Revisão atrasada** — `revisado=false` há > 3 dias → tarefa para o revisor padrão.
6. **Projeção de caixa** — saldo projetado D+30 negativo → alerta crítico.
7. **Importação parcial** — importação com `linhas_ignoradas > 0` → tarefa de revisão.

A DSL fica em `config jsonb` para o usuário criar regras novas via UI no futuro sem deploy.

---

### Bloco C — Camada de IA (classificação)

Server function `classificarLancamento(descricao, valor, empresa_id)`:

1. Tenta `categoria_sugestoes` por hash da descrição normalizada (rápido, grátis).
2. Se sem hit, chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com tool calling estruturado retornando `{categoria_id, confianca}`.
3. Grava no cache.

Usado em dois pontos: ao importar CSV (auto-categoriza com `origem_classificacao='ia'`) e em ação manual "Sugerir categoria" no lançamento.

---

### Bloco D — Cockpit (UI)

Substitui `/_authenticated/index.tsx`. Layout mobile-first:

```text
┌────────────────────────────────────────────────┐
│  Olá, João · 14 mai · [+ Nova ação ▾]          │
├────────────────────────────────────────────────┤
│  Tabs:  HOJE · AGUARDANDO · TRAVADO ·          │
│         OPORTUNIDADES · FOLLOW-UP              │
├────────────────────────────────────────────────┤
│  [Aba HOJE]                                    │
│  🔴 3 alertas críticos                         │
│   · Caixa projetado negativo em 12 dias        │
│   · Marketing +47% vs média                    │
│   · 312 lançamentos sem categoria              │
│  🟡 8 tarefas vencendo hoje                    │
│  🟢 2 oportunidades detectadas                 │
└────────────────────────────────────────────────┘
```

Cada card: título, contexto (1 linha), **ação primária** (Resolver / Categorizar / Snooze / Atribuir). Swipe lateral no mobile = snooze/ack. Sem tabela.

Componentes novos:

- `src/components/cockpit/CockpitTabs.tsx`
- `src/components/cockpit/AlertaCard.tsx`
- `src/components/cockpit/TarefaCard.tsx`
- `src/components/cockpit/CapturaRapida.tsx` (FAB global, só botão por enquanto — voz/OCR ficam na fase 2)

---

### Bloco E — Limpeza

- Apagar dashboard atual (`src/routes/_authenticated/index.tsx`) e refazer.
- Manter `/razao`, `/lancar`, `/a-revisar`, `/stone`, `/importacoes`, `/usuarios` por ora — serão reformulados nas próximas fases. Não toca neles agora.

---

### Detalhes técnicos

- Banco: 1 migration consolidada para Bloco A.
- RLS: `alertas`/`tarefas` visíveis se o usuário tem permissão na empresa (reusa lógica `usuario_empresas` + `ve_todas_empresas`); `regras` só admin.
- Server functions sob `requireSupabaseAuth`; rota cron sob `/api/public/` com header `x-cron-secret`.
- AI via `process.env.LOVABLE_API_KEY` dentro do handler.
- Sem mudança em `package.json` esperada.

---

### Fora desta fase (próximas)

- Captura por voz e foto+OCR (Fase 2).
- CRM Imobiliária, Mídia/Pontos, Stone churn (Fases 4-5).
- Copilot pergunta-livre (Fase 6).
- WhatsApp como canal (depois).
