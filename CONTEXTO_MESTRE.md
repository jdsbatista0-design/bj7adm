# CONTEXTO_MESTRE — BJ7 Central

## Missão

O BJ7 Central é o cockpit executivo do Grupo BJ7 — não um ERP.

O objetivo é responder, em segundos, seis perguntas críticas:
1. Como está a saúde financeira do grupo?
2. Onde tem dinheiro parado, vazando ou em risco?
3. Quem precisa agir hoje?
4. Quais decisões dependem do Jonathas ou do Bruno?
5. O que pode ser delegado?
6. Quantos dias o grupo consegue rodar bem sem intervenção direta dos donos?

**Princípio central:** o sistema deve reduzir a dependência dos sócios, não criar mais trabalho.

---

## Objetivo final

Jonathas (Jow) e Bruno devem poder viajar, ficar com a família, praticar wakeboard, surf, corrida de carro (drag racing, Porsche 911) e tocar o grupo **sem depender de apagar incêndio todo dia**.

---

## Estrutura do Grupo BJ7

| ID | Empresa | Negócio |
|----|---------|---------|
| 1 | BJ7 (Mídia) | Outdoors roadside — estrutura física + venda de espaços |
| 2 | BJ7 (Stone) | Franquia Stone Litoral PR (Pontal, Paranaguá, Guaratuba, Matinhos) |
| 3 | Izi | Incorporadora — Edifício Izi em construção |
| 4 | Batista & Prendin | Entidade do grupo |
| 5 | Grupo BJ7 | Holding mãe |
| 6 | Izi Casas | Operação de imóveis (vacation rentals) |
| 7 | Izi Imóveis | Imobiliária |

**Sócios:** Jonathas (Jow) e Bruno

---

## Convenções Contábeis

### Regra de ouro para todas as queries DRE

```sql
-- SEMPRE filtrar contar_no_total = TRUE
-- Lançamentos com FALSE são duplicações eliminadas ou lixo contábil
SELECT * FROM lancamentos WHERE contar_no_total = TRUE;
```

### Regime de caixa Stone

A receita Stone é registrada pela data de **pagamento**, não pelo mês de **referência**. Lançamentos Stone carregam a tag `[ref:YYYY-MM]` no início da descrição para indicar competência:

```sql
-- Receita Stone de Janeiro/2025 (paga em Fevereiro/25)
SELECT * FROM lancamentos WHERE descricao LIKE '[ref:2025-01]%';
```

### Prefixos de grupo DRE

| Prefixo `grupo` | Significado | Entra no DRE Operacional? |
|---|---|---|
| `receita_*` | Receitas | Sim |
| `desp_*` (exceto financeira/impostos) | Despesas operacionais | Sim |
| `desp_financeira` / `desp_impostos` | Despesas não-operacionais | Apenas DRE completo |
| `investimento_*` | CapEx | Não — apenas em "Investimentos" |
| `fora_dre_*` | Retiradas e empréstimos | Não — movimentação patrimonial |

### Campo `tipo_predominante` vs `tipo`

- `categorias.tipo_predominante` → "Receita", "Despesa", "Retirada", "Empréstimo" (semântico)
- `lancamentos.tipo` → o tipo do lançamento individual
- Para agregações DRE, use `categorias.grupo` (mais semântico e correto)

### Views analíticas

| View | O que faz |
|---|---|
| `v_resumo_dre` | DRE consolidado por empresa/ano com EBITDA calculado |
| `dre_consolidada` | Agregado por empresa/mês/grupo (com `natureza_dre`) |
| `dre_operacional` | DRE operacional puro — sem retiradas, CapEx, impostos |
| `dre_view` | Versão completa por ano/mês com todas as flags |

---

## Regras de Operação no Banco

**Antes de qualquer UPDATE em massa:**
1. `CREATE TABLE _backup_X AS SELECT * FROM tabela WHERE condição;`
2. Usar `BEGIN ... COMMIT` — com rollback disponível
3. Verificar com `COUNT/SUM` antes e depois
4. Nunca `DELETE` sem antes marcar `contar_no_total = FALSE` (reversível)

**Para reclassificação:**
1. Investigar primeiro com `SELECT top_padrões`
2. Decidir com o sócio quando valor > R$ 1.000 e ambíguo
3. Regex automático para padrões claros (> 10 ocorrências)
4. Caso-a-caso para os ambíguos

---

## Indicador de Dependência dos Sócios (futuro)

### O que é

Mede quantos itens, decisões e ações **estão presos nos sócios** e por quanto tempo o grupo consegue rodar sem intervenção direta.

### Como implementar

**Fase 1 — Atribuição (banco):**
- Adicionar campo `responsavel_nome` (ou `atribuido_para`) na tabela `itens`
- Valores sugeridos: "Jonathas", "Bruno", "Time", "Externo"

**Fase 2 — Cálculo:**
```sql
-- Itens aguardando os sócios
SELECT COUNT(*) FROM itens
WHERE responsavel_nome IN ('Jonathas', 'Bruno')
  AND estado NOT IN ('CONCLUIDO', 'ARQUIVADO');

-- Decisões pendentes dos sócios
SELECT COUNT(*) FROM itens
WHERE tipo = 'DECISAO'
  AND decisao_tomada IS NULL
  AND responsavel_nome IN ('Jonathas', 'Bruno');
```

**Fase 3 — Indicador "dias sem intervenção":**
- Última data em que Jonathas ou Bruno concluíram um item
- Comparar com hoje → "o grupo roda N dias sem intervenção dos sócios"

**Onde exibir:**
- Card na home `/` (futura dashboard executiva)
- Seção "Hoje" no `/hoje`

### Critério de "boa delegação"
- < 5 itens aguardando os sócios: verde
- 5–15 itens: amarelo
- > 15 itens: vermelho

---

## Prioridades do Projeto Agora

1. Financeiro confiável e DRE por empresa
2. Documentos e contratos com vencimentos
3. Hoje: alertas, tarefas, responsáveis e decisões pendentes
4. Indicador de dependência dos sócios
5. Open Finance — ingestion automática de extratos bancários

---

## Dívidas Técnicas Mapeadas

### Stone (auditoria)
- Set-Dez/25 sem alíquota (formato de planilha mudou)
- Jul/25 sem planilha (veio pela NF)
- 4 meses 2026 sem alíquota
- Dez/22 ausente em `rebate_componentes_stone`
- Rebate Crédito 2025 — 6 planilhas com extração falha

### Geral
- 916 lançamentos NÃO CLASSIFICADO × R$ 709k
- 9 lançamentos BRUNO/JHOU PAGO 2022-2023 (R$ 466k) — decidir tipo
- 45 lançamentos Izi com R$ 0 (IPTU, IMOBZI, GOOGLE) — preencher valores
- 97 lançamentos OBRA sem unidade — atribuir imóvel
- 476 lançamentos `contar_no_total=false` antigos — investigar

### Open Finance (Pluggy)
- 3 Edge Functions chamadas mas não versionadas no repo — ver `EDGE_FUNCTIONS.md`
- Tabela para armazenar conexões Pluggy não está no schema
