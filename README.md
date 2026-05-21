# 🏢 BJ7 Central

Sistema financeiro consolidado do **Grupo BJ7**, holding que opera 5 negócios simultâneos no litoral do Paraná.

> **Status:** ✅ Em produção · 8 anos de dados auditados · Eliminação de R$ 8 mi em distorções de DRE
> **Última atualização:** 20 de maio de 2026
> **Repositório:** [github.com/jdsbatista0-design/bj7adm](https://github.com/jdsbatista0-design/bj7adm)
> **Preview:** [preview--bj7adm.lovable.app](https://preview--bj7adm.lovable.app)

---

## 🎯 Propósito

Eliminar a "cegueira financeira" do Grupo BJ7 consolidando cash flow, DRE, categorias e cost centers de 7 empresas num único banco de dados confiável e em tempo real.

Substitui anos de planilhas manuais e oferece visibilidade real do lucro operacional, perdas históricas, retiradas de sócios e investimentos.

---

## 🏗 Estrutura do Grupo BJ7

| ID | Empresa | Negócio |
|----|---------|---------|
| 1 | BJ7 (Mídia) | Outdoors roadside (estrutura física + venda de espaços) |
| 2 | BJ7 (Stone) | Franquia Stone Litoral PR (Pontal, Paranaguá, Guaratuba, Matinhos) |
| 3 | Izi | Incorporadora (Edifício Izi em construção) |
| 4 | Batista & Prendin | (entidade do grupo) |
| 5 | Grupo BJ7 | Holding mãe |
| 6 | Izi Casas | Operação de imóveis (vacation rentals) |
| 7 | Izi Imóveis | Imobiliária |

**Sócios:** Jonathas (Jow) e Bruno

---

## 🚀 Stack Técnica

### Frontend
- **Framework:** React 19 + TanStack Router + TanStack Query
- **Estilização:** TailwindCSS 4 + shadcn/ui
- **Gráficos:** Recharts
- **Builder:** Lovable (no-code/low-code, deploy via GitHub)

### Backend
- **Banco:** Supabase (PostgreSQL gerenciado)
- **Auth:** Supabase Auth
- **Edge Functions:** Supabase
- **Project ID:** `fcalhtuolxxeijxnquqj`

### Ferramentas auxiliares
- **Antigravity IDE:** execução de SQL via connection string direta
- **Python:** análise/extração de planilhas Stone (pandas, openpyxl, pyxlsb)
- **Claude:** auditoria e modelagem de dados

---

## 📊 Modelo de Dados

### Tabelas Principais

| Tabela | Linhas | Propósito |
|---|---|---|
| `lancamentos` | 12.373 | Registro contábil principal (receitas, despesas, retiradas, empréstimos) |
| `categorias` | 18 | Plano de contas com `grupo` e `tipo_predominante` |
| `unidades` | 4 | Centros de custo (imóveis) |
| `empresas` | 7 | As 7 empresas do grupo |

### Tabelas Stone

| Tabela | Status | Propósito |
|---|---|---|
| `rebate_componentes_stone` | 63 meses populados (2021-2026) | Detalhamento mensal do rebate principal |
| `rebate_outros_stone` | 21 fluxos populados | Fluxos paralelos (Seguros, Crédito, Campanhas, Bônus, Ajustes Retroativos) |
| `rebate_clientes_stone` | Vazia | Granularidade cliente-a-cliente (~250k linhas pendentes) |
| `documentos_fiscais_stone` | Vazia | PDFs e XMLs das NFs |

### Views Analíticas

| View | O que faz |
|---|---|
| `v_resumo_dre` | DRE consolidado por empresa/ano com EBITDA já calculado |
| `dre_consolidada` | Agregado por empresa/mês/grupo (com `natureza_dre`) |
| `dre_operacional` | DRE operacional puro (sem retiradas, sem CapEx, sem impostos) |
| `dre_view` | Versão completa por ano/mês com todas as flags |

### Classificação Contábil Inteligente

Toda categoria tem um campo `grupo` que dispara classificação automática:

| Prefixo `grupo` | Significado | Entra no DRE Operacional? |
|---|---|---|
| `receita_*` | Receitas | ✅ Sim |
| `desp_*` (exceto financeira/impostos) | Despesas operacionais | ✅ Sim |
| `desp_financeira` / `desp_impostos` | Despesas não-operacionais | ⚠️ DRE completo apenas |
| `investimento_*` | CapEx | ❌ Apenas em "Investimentos" |
| `fora_dre_*` | Retiradas e empréstimos | ❌ Movimentação patrimonial |

---

## 📈 Funcionalidades Atuais

### Módulo Financeiro (`/financeiro`)
Hub central com 3 tabs:

- **Lançamentos** (default): Tabela paginada com filtros por empresa, categoria, unidade, período, tipo
- **Análise**: Cards de KPI (Receita, Despesa, EBITDA, Lucro) + gráficos de evolução e composição
- **Relatórios**: BI completo com drill-down

### Outros módulos
- `/empresas` — DRE por empresa, fluxo de caixa específico
- `/itens` — Cadastro de bens e ativos
- `/importacoes` — Histórico de importações de planilhas
- `/configuracoes` — Setup do sistema
- `/` (Início) — Hub de navegação visual

---

## 🛡 Auditoria Realizada (Histórico)

### Receita Stone (2018-2026)

| Período | Status | Achados |
|---|---|---|
| 2018-2020 | ✅ Fechada | R$ 70.510 (3 NFs Ago/2020) recuperados |
| 2021-2022 | ✅ Fechada | Triple-source 100% (planilha × NF × banco) |
| 2023-2024 | ✅ Fechada | Modelo 2023 (Rebate23) catalogado |
| 2025-2026 | ✅ Parcial | 15 INSERTs em rebate_componentes_stone |

**Total auditado:** R$ 14.185.134,99 em receita Stone (8 anos)

### Perdas Identificadas

| Ano | Meses | Perda | Alíquota média |
|---|---|---|---|
| 2024 | 12 | **R$ 206.656,89** | 41,67% 🔴 |
| 2025 | 7 (Jan-Fev) | **R$ 62.976,47** | 43,57% |
| **Total** | | **R$ 269.633** | |

### Limpezas Aplicadas

| Distorção | Lançamentos | Valor |
|---|---|---|
| Duplicação cross-file (DESPESAS 2025/2026 vs DESPESAS_2025/2026) | ~1.400 | R$ 4.228.616 |
| Linhas "TOTAL" de planilha contadas como despesa | 27 | R$ 1.344.534 |
| Retirada Sócio inflada (era R$ 6 mi → real R$ 3,77 mi) | 48 | R$ 2.281.012 |
| **Total de distorções corrigidas** | **~1.475** | **~R$ 8.000.000** |

### Reclassificação Massiva

| Etapa | Lançamentos reclassificados | Estratégia |
|---|---|---|
| ETAPA A | 27 (R$ 1,34 mi) | Eliminação de lixo "TOTAL" |
| ETAPA B | 1.683 (R$ 1,46 mi) | Regex automático (combustível, refeições, salários, ferry, etc) |
| ETAPA C | ~400 (R$ 600k) | Decisões caso a caso (veículos, OBRA, CUSTOS Izi) |
| **Total** | **~2.110 lançamentos** | **~67% de redução em NÃO CLASSIFICADO** |

---

## 📊 Resultados Visíveis no DRE

### BJ7 Stone 2024 (DRE Operacional)
```
Receita Operacional:        R$ 3.348.802
Despesa Operacional:        R$ 1.589.152
─────────────────────────────────────
EBITDA Operacional:         R$ 1.759.649  (52,5% margem ⭐)
Despesa Não-Operacional:    R$   680.314
Movimentação Patrimonial:   R$   602.823  (retirada sócio)
─────────────────────────────────────
Lucro Líquido Pré-CapEx:    R$ 1.079.335  (32% da receita)
```

### Distribuição de Categorias (Estado Atual)

| Categoria | Lanç | Total |
|---|---|---|
| PESSOAL | 3.326 | R$ 4.144.326 |
| DESPESAS GERAIS | 1.665 | R$ 835.585 |
| OBRA | 1.524 | R$ 4.376.117 |
| NÃO CLASSIFICADO ⚠️ | 916 | R$ 709.602 |
| FROTA | 675 | R$ 227.779 |
| UTILIDADES | 614 | R$ 154.280 |
| OPERAÇÃO IMÓVEL | 515 | R$ 287.314 |
| IMPOSTOS | 411 | R$ 2.936.196 |
| RETIRADA SÓCIO | 279 | R$ 3.777.030 |
| MARKETING | 278 | R$ 1.977.936 |
| LOCAÇÃO TEMPORADA | 229 | R$ 808.730 |
| RECEITA STONE | 163 | R$ 14.185.134 |
| SERVIÇOS PROFISSIONAIS | 119 | R$ 50.368 |
| EMPRÉSTIMO FUNCIONÁRIO | 84 | R$ 82.597 |
| JUROS E TARIFAS BANCÁRIAS | 78 | R$ 76.427 |
| INVESTIMENTOS | 56 | R$ 164.115 |
| CARTÃO DE CRÉDITO | 18 | R$ 119.713 |

---

## 🚦 Convenções Importantes

### Para todas as queries DRE

```sql
-- SEMPRE filtrar contar_no_total = TRUE
-- Lançamentos marcados FALSE são duplicações eliminadas ou lixo
SELECT * FROM lancamentos WHERE contar_no_total = TRUE;
```

### Para usar views agregadas (recomendado)

```sql
-- DRE Operacional puro (sem retiradas, sem CapEx, sem impostos)
SELECT * FROM dre_operacional WHERE empresa_id = 2 AND ano = 2024;

-- DRE completo com EBITDA já calculado
SELECT * FROM v_resumo_dre WHERE empresa_id = 2 AND ano BETWEEN 2021 AND 2026;

-- Evolução mensal por grupo
SELECT * FROM dre_consolidada 
WHERE empresa_id = 2 AND mes_ref >= '2024-01-01'
ORDER BY mes_ref;
```

### Identificação de lançamentos Stone

Lançamentos de receita Stone têm tag `[ref:YYYY-MM]` no início da descrição indicando o **mês de competência** (não o mês de pagamento):

```sql
-- Receita Stone Jan/2025 (paga em Fev/25)
SELECT * FROM lancamentos 
WHERE descricao LIKE '[ref:2025-01]%';
```

### Categorias x Tipos

Coluna `categorias.tipo_predominante` (não `tipo`) tem valores como "Receita", "Despesa", "Retirada", "Empréstimo".

A `categorias.grupo` é mais semântica e permite agregações DRE.

---

## ⚠️ Dívidas Técnicas Mapeadas

### 🟡 Auditoria Stone (refinamentos)

- [ ] Set-Dez/25 sem alíquota (formato planilha mudou)
- [ ] Jul/25 sem planilha (foi pela NF)
- [ ] 4 meses 2026 sem alíquota
- [ ] Dez/22 ausente em rebate_componentes_stone
- [ ] id 5627 (R$ 12.000 "Dezembro") sem ref clara
- [ ] Rebate Crédito 2025 - 6 planilhas (extração falhou)
- [ ] Apuração Logística Mar+Abr/26 - Modelo Antigo vs Novo
- [ ] Triple-check Sessão 3 com NFs 2023 (chegaram tarde)
- [ ] Anomalia Jan/2023 (planilha R$ 30k vs banco R$ 250k)

### 🔴 Auditoria Geral

- [ ] **Frente 1:** investigar despesas Izi vazadas em BJ7 Stone (Izi com 97% margem é irreal)
- [ ] **NÃO CLASSIFICADO restante:** 916 lançamentos × R$ 709k
- [ ] **Problema 2:** 9 lançamentos BRUNO/JHOU PAGO 2022-2023 (R$ 466k) — decidir tipo Retirada vs Despesa
- [ ] **45 lançamentos Izi com R$ 0** (IPTU, IMOBZI, GOOGLE) — preencher valores
- [ ] **8 hotéis em LOCAÇÃO TEMPORADA** — mover pra DESPESAS GERAIS
- [ ] **97 lançamentos OBRA sem unidade** — atribuir imóvel
- [ ] **476 lançamentos contar_no_total=false antigos** — investigar

### 🔵 Projetos Futuros

- [ ] Performance Lovable (queries paginadas para agregar = 40s — prompt entregue)
- [ ] Popular `rebate_clientes_stone` (2.300 clientes/mês × 9 anos)
- [ ] Popular `rebate_outros_stone` 2025-2026
- [ ] Popular `documentos_fiscais_stone` (PDFs/XMLs)
- [ ] Módulo Incorporadora Izi dedicado (OBRA = R$ 4,3 mi sem analítica)
- [ ] Tela de Metas Mensais
- [ ] Open Finance ingestion (extratos bancários automatizados)
- [ ] Login Lovable + Supabase Auth (issues antigas)

---

## 🛡 Backups Existentes

Backups criados durante a operação de hoje (permanecem até confirmação de estabilidade):

```
_backup_simplificacao_2026_05_18
_backup_descricoes_stone_2026_05_18
_backup_descricoes_stone_2025
_backup_dedup_underscore_2026_05_20
_backup_dedup_final_2026_05_20
_backup_total_lixo_2026_05_20
_backup_nao_classificado_2026_05_20
_backup_nao_classificado_etapaC_2026_05_20
_backup_hoteis_2026_05_20
```

Pode dropar todos após 1-2 semanas confirmando que tudo está estável.

---

## 🤝 Princípios de Operação

### Para mexer no banco
1. **Sempre BACKUP antes** de UPDATE em massa (`CREATE TABLE _backup_X AS SELECT ...`)
2. **Sempre TRANSACTION** (`BEGIN ... COMMIT`) com rollback possível
3. **Sempre VERIFY** com COUNT/SUM antes e depois
4. **Nunca DELETE** sem antes marcar `contar_no_total=FALSE` (reversível)

### Para reclassificação
1. **Investigar primeiro** (SELECT de top padrões)
2. **Decidir com o sócio** quando ambíguo (R$ 1.000+)
3. **Regex automático** para padrões claros (>10 ocorrências)
4. **Caso-a-caso** para os ambíguos

### Para mudança estrutural
1. **Refator drop+rename** já tentado e abortado — modelo atual funciona
2. Mantemos `categorias` + `unidades` + `grupo` como solução

---

## 📞 Contato e Operação

**Owner:** Jonathas (Jow) Batista
**Email do Github:** jdsbatista0-design
**Frequência de uso:** Diária para visualização, mensal para importação de planilhas

---

## 🎓 Aprendizados Documentados

- **Confiança vem de disciplina operacional**, não só de código correto
- **Regime de caixa vs competência** importa: Receita Stone é registrada pela data de **pagamento**, não pelo mês de **referência** (resolvido com tag `[ref:YYYY-MM]`)
- **Importação de planilhas dobradas** (espaço vs underscore) gerou R$ 4 mi em duplicação — sempre verificar nomes de arquivo
- **Linhas "TOTAL" de planilhas** podem ser parseadas como dados — sempre filtrar
- **DRE limpo separa Operacional, Não-Operacional, CapEx e Movimentação Patrimonial** — confunde no início, mas é o jeito certo

---

## 📜 Histórico de Mudanças Estruturais

### Maio/2026 — Grande Refatoração
- Categorias simplificadas 28 → 18 (com `grupo` semântico)
- Unidades reduzidas 11 → 4 (apenas imóveis)
- Views DRE inteligentes implementadas
- Eliminação de R$ 8 mi em distorções
- Módulo Financeiro unificado no Lovable
- Reclassificação de 67% dos NÃO CLASSIFICADO
- 4 tabelas Stone novas criadas e populadas
- 161 lançamentos Stone com tag `[ref:YYYY-MM]`

### Abril/2026 — Início do Projeto
- Criação no Lovable + Supabase
- Importação inicial de 12.373 lançamentos históricos (2018-2026)
- Primeira estrutura de categorias e unidades
- Tela de lançamentos básica funcional

---

**Status atual: ~80% completo. Pronto para uso operacional diário.** 🎯
