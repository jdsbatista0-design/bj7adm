## Objetivo

Importar arquivo de rebate Stone (.xlsx/.csv) → tratar, gravar histórico por cliente, e gerar **1 conta a receber** por importação. Quando essa conta for marcada como **recebida**, vira automaticamente **1 lançamento de Receita** no DRE. Adicionar filtro de período em Clientes Stone.

---

## 1. Banco (migração única)

**Novas tabelas**

`stone_rebate_imports` (header)
- `id`, `arquivo_nome`, `arquivo_hash` (unique — bloqueia reimport idêntico)
- `usuario_id`, `empresa_id` (destino do lançamento — escolhida na importação)
- `periodo_inicio`, `periodo_fim`, `mes_referencia`
- `status` (`pendente` | `prevalidado` | `importado` | `revertido` | `erro`)
- `total_linhas`, `linhas_ok`, `linhas_erro`, `linhas_duplicadas`
- `valor_total_rebate` (soma usada na conta a receber)
- `conta_a_pagar_id` (FK → `contas_a_pagar`, a "conta a receber" gerada)
- `lancamento_id` (FK → `lancamentos`, preenchido só quando marcada como recebida)
- `observacao`, `mapeamento_json`, `created_at`

`stone_rebate_linhas` (staging + histórico)
- `id`, `import_id` (FK cascade), `linha_num`
- `stonecode`, `documento`, `nome_cliente`
- `data_referencia`, `mes_referencia`
- `tpv`, `receita_bruta`, `rebate_valor`, `mdr`, `antecipacao`, `aluguel`
- `produto`, `bandeira`, `canal`, `cidade`, `rota`
- `status_conciliacao`, `erro_importacao`, `dados_originais_json`

**Categoria fixa** (seed): cria `categorias` com nome **"Receita Stone - Rebate"**, tipo `Receita` se não existir. ID guardado em config/constante.

**GRANTs + RLS**: `authenticated` lê/escreve; `service_role` ALL. Políticas usando `has_role` / `pode_gerir_usuarios`.

**Sem alteração** em `rebate_clientes_stone` nem `lancamentos` nem `contas_a_pagar` (já têm `lancamento_id`).

---

## 2. Importador `/stone/importar-rebate`

Stepper 4 passos (client-side, parser SheetJS):

1. **Upload** — `.xlsx`/`.csv`, calcula hash, bloqueia se já importado
2. **Mapeamento automático** — detecta colunas via sinônimos (`Stone Code`/`Stonecode`/`Código`, `Rebate`, `TPV`, `Mês referência`, etc). Usuário ajusta se preciso. Opção "salvar template".
3. **Pré-visualização + validação** — mostra: total linhas, linhas OK, linhas com erro (campo vazio, valor inválido, mês inválido), duplicadas internas, conflitos com `rebate_clientes_stone` `(stonecode, mes_referencia)`. Mostra **valor total do rebate** + escolha de **empresa de destino** + **data de vencimento** da conta a receber (default: último dia do mês de referência).
4. **Confirmação** — escreve `stone_rebate_imports` + `stone_rebate_linhas`, faz upsert em `rebate_clientes_stone` por `(stonecode, mes_referencia)`, e cria **1 conta a pagar** (`tipo` receita via marca em observação — segue padrão atual: `parseTipoFromObs` reconhece "Tipo: Receita") com:
   - `descricao`: "Rebate Stone — {mes}/{ano} ({arquivo})"
   - `valor`: soma `rebate_valor`
   - `empresa_id`: a escolhida
   - `categoria_id`: "Receita Stone - Rebate"
   - `vencimento`: data informada
   - `pago`: false
   - `observacao`: `Tipo: Receita | Origem: stone_rebate | import_id: N`

**Não cria lançamento agora.** O lançamento nasce quando a conta for marcada como recebida via fluxo existente `pagarConta()` (que já lê `Tipo: Receita` da observação e cria `lancamentos.tipo='Receita'`). Zero código novo no DRE/cockpit/calendário — herdam de graça.

---

## 3. Histórico `/stone/importacoes` (aba nova ou rota)

Lista importações com: data, arquivo, mês ref, valor total, status, conta vinculada (badge "A receber"/"Recebido"/"Revertido"), linhas ok/erro/dup.

Ações:
- **Ver detalhes** — drawer com linhas OK e linhas com erro
- **Reverter** — confirm dialog. Apaga: `stone_rebate_linhas`, registros de `rebate_clientes_stone` desta importação (`import_id`), `lancamentos` (se foi recebida), `contas_a_pagar` vinculada. Marca import como `revertido`.

---

## 4. Filtro de período em `clientes-stone.tsx`

Barra topo: preset (Este mês / Mês passado / Últimos 3m / 6m / Ano / Personalizado) + range manual. Default: **últimos 3 meses**.

Propaga para: KPIs dos 4 segmentos, ranking, gráfico de evolução, drawer individual do cliente.

Drawer do cliente passa a mostrar:
- TPV/Receita/Rebate por mês (do range)
- Melhor/pior mês
- Último mês ativo
- Histórico de importações onde apareceu (via `stone_rebate_linhas.import_id`)

Export CSV respeita o filtro.

---

## 5. Permissões

- `podeImportar` (Admin/Sócio — já existe): vê `/stone/importar-rebate` e botão Reverter
- `podeVerStone`: continua vendo Clientes Stone e histórico em modo leitura

---

## 6. Ordem de execução

```text
1. Migração SQL (tabelas + categoria seed + GRANTs + RLS)
2. Tipos: regenerar database.ts (manual após migração)
3. /stone/importar-rebate (parser + stepper + confirmação)
4. /stone/importacoes (lista + reverter)
5. clientes-stone.tsx (filtro período + drawer com histórico)
6. Menu lateral: links em "Stone"
```

## 7. Fora desta rodada

- Conciliação cliente-a-cliente
- Edição de linha individual após import (só reverter + reimportar)
- Comissão de vendedor automática
- Email/alerta quando conta a receber vence sem baixa

---

### Diagrama do fluxo de dinheiro

```text
arquivo.xlsx
   │
   ▼
[Importar] ──► stone_rebate_imports (status: importado)
              stone_rebate_linhas (N linhas)
              rebate_clientes_stone (upsert por stonecode+mes)
              contas_a_pagar (1 linha, Tipo: Receita, pago=false)
                          │
                          ▼
              [Marcar como recebida em Contas a Pagar]
                          │
                          ▼
                  lancamentos (Receita) ──► DRE, Cockpit, Calendário
```
