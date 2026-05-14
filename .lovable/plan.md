# Plano — BJ7 Central

Sistema interno de gestão financeira em pt-BR, R$ 1.234.567,89, tema claro sóbrio, sobre Supabase externo já populado (não criar/alterar tabelas — apenas ler/escrever e configurar RLS).

## 1. Setup e conexão com Supabase externo

- Você fornece `SUPABASE_URL` e `SUPABASE_ANON_KEY` (e opcionalmente `SUPABASE_SERVICE_ROLE_KEY` para a tela de Importação). Vou pedir esses valores em um próximo passo via secrets.
- Criar `src/integrations/supabase/client.ts` com `createClient` usando `import.meta.env.VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (persist session em localStorage).
- Gerar `src/integrations/supabase/types.ts` manualmente refletindo as 12 tabelas conforme o BLOCO 0 (sem migrations — schema já existe).
- Stack: TanStack Start já configurado, TanStack Query para data fetching, shadcn/ui, Tailwind, Recharts para gráficos, react-hook-form + zod para forms, date-fns com locale pt-BR. Helper `formatBRL` e `formatDate`.

## 2. Autenticação e contexto de permissões (Bloco 1)

- Rota `/login` (pública): email + senha via `supabase.auth.signInWithPassword`.
- Layout `_authenticated` com `beforeLoad` que verifica sessão; redireciona para `/login` se ausente.
- Hook `useCurrentUser`: após login carrega de `usuarios` (por `auth_uid`) → papel + flags (`ve_retiradas`, `ve_faturamento`, `ve_todas_empresas`) + lista de `usuario_empresas`. Disponibilizado via Context.
- **Tela "Meu cadastro / vincular conta"**: como `auth_uid` está vazio, no primeiro login o sistema procura `usuarios` pelo email; se encontrar com `auth_uid IS NULL`, faz `UPDATE usuarios SET auth_uid = auth.uid() WHERE email = ?`. Se nenhum match → mensagem "conta não autorizada, contate o admin".
- Logout no header.
- Helpers `can.editLancamento(l)`, `can.markRevisado()`, `can.manageUsers()`, `filters.tiposVisiveis()` aplicados em todo lugar.

## 3. Layout global

- Sidebar fixa com navegação: Dashboard, Razão, A Revisar, Stone (se `ve_faturamento`), Importações (Admin/Sócio), Usuários (Admin/Sócio).
- Header com nome do usuário, papel, botão sair.
- Rotas dentro de `src/routes/_authenticated/`.

## 4. Dashboard (Bloco 2) — `/`

- Filtros topo: ano (2018–2026), empresa (Todas + 3).
- Server-side: query agregada em `lancamentos` filtrando por ano/empresa/tipos visíveis/empresas visíveis/`contar_no_total`.
- Cards: Receitas, Despesas, Retiradas, Resultado, Lançamentos a revisar — escondidos conforme flags.
- Gráfico linha Receitas vs Despesas mês a mês (Recharts).
- Gráfico barras Resultado por empresa (quando "Todas").
- Tabela 28 categorias × total no período.
- Cada card / linha de categoria → navega para `/razao?ano=…&tipo=…&categoria=…`.

## 5. Razão (Bloco 3) — `/razao`

- Search params type-safe (`validateSearch` com zod): ano, mes, empresa, unidade, categoria, tipo, status, busca, soNaoRevisados, page, sort.
- Tabela paginada (50/pg) ordenável; query com `range()` no Supabase.
- Filtros aplicados aos search params (drill-down funciona).
- Linha clicável → Sheet/Dialog com detalhes completos, inclusive `arquivo_origem`, `aba_origem`, `linha_origem`, `criado_em`, `revisado_por`, `revisado_em`.
- Se `tipo=Receita` e existir `notas_fiscais.lancamento_id` correspondente → seção "Nota fiscal" no detalhe (numero, tomador, categoria, arquivo).
- Permissões aplicadas no `select` (filtra `tipo` e `empresa_id`).
- Botões na linha: Editar, Marcar revisado, Desmarcar revisado — visíveis conforme regras.

## 6. Stone (Bloco 4) — `/stone`

Visível apenas se `ve_faturamento = true` (guard no `beforeLoad`).
- Aba Notas Fiscais: gráfico barras receita/ano + tabela detalhada por nota.
- Aba Evolução da base: gráfico linha `qtd_clientes`, tabela `novos_no_mes` / `sumiram_no_mes`.
- Aba Clientes sumidos: tabela com destaque (badge vermelho) para `atencao = true`.
- Aba Apuração rebate: tabela mês a mês.

## 7. Lançar / Editar / Revisar (Bloco 5)

- Botão "Novo lançamento" no Razão → `Dialog` com form (zod):
  - data, empresa (select), unidade (select dependente), categoria (select), tipo, subcategoria, descrição, valor (input com máscara R$), status.
  - `INSERT` com `revisado=false`, `criado_em=now()`, `contar_no_total=true`.
- Editar: mesmo dialog preenchido. Botão habilitado por `can.editLancamento` (Sócio sempre; Admin/Gestor só se `revisado=false`).
- Marcar/Desmarcar revisado: botão (Admin e Sócio) → `UPDATE revisado, revisado_por=usuario.id, revisado_em=now()`.
- Página `/a-revisar`: Razão filtrado fixo `revisado=false`, com ações inline.

## 8. Importações (Bloco 6) — `/importacoes`

Visível Admin/Sócio.
- Tabela do histórico de `importacoes` (arquivo, data, linhas inseridas/ignoradas).
- Upload CSV com Papaparse (parse client-side).
- Geração do `hash_origem` exatamente conforme sua fórmula:
  - `texto = f"{arquivo_origem}|{aba_origem}|{linha_origem}|{data}|{valor}|{descricao}"` com campos vazios = `"None"`, data ISO `YYYY-MM-DD`, valor decimal, depois MD5 hex 32 chars (usar `crypto-js/md5` no browser).
- Para cada linha: gerar hash, dedupe contra `hash_origem` já existentes (fetch em batches via `in()`), inserir só os novos.
- Inserir registro em `importacoes` com contadores.
- Mostrar resumo "X novos / Y duplicados".
- **Aviso visível na tela**: "Teste reimportando arquivo já existente — todos devem ser ignorados. Se inserir como novos, a fórmula de hash divergiu."

## 9. Gestão de usuários (parte do Bloco 1) — `/usuarios`

Visível Admin/Sócio.
- Listar `usuarios` com papel e flags.
- Criar: email + papel + flags + (se Gestor com `ve_todas_empresas=false`) seleção das empresas → `INSERT usuarios` + cria conta no Auth via Admin API (precisa service role) + insert em `usuario_empresas`.
- Editar: papel, flags, empresas vinculadas.

## 10. RLS (Bloco 7) — instruções e SQL para você rodar no Supabase

Como o Supabase é externo, **eu não posso aplicar RLS daqui**. Vou entregar:
- Arquivo `supabase/policies.sql` com todo o SQL pronto para colar no SQL Editor do seu Supabase.
- Função SECURITY DEFINER `current_user_perms()` retornando `papel, ve_faturamento, ve_retiradas, ve_todas_empresas` baseada em `auth.uid() → usuarios`.
- Função `current_user_empresa_ids()` retornando array.
- Policies por tabela conforme o Bloco 7 (lancamentos com filtro de tipo + empresa, notas/rebate/evolução/sumidos só com `ve_faturamento`, usuarios/papeis/usuario_empresas só Admin/Sócio, empresas/unidades/categorias leitura aberta para autenticados).
- Update de lançamento revisado: policy WITH CHECK separada que exige papel = Sócio.
- **Seção "Como testar"** no `README.md`: passo a passo para criar Gestor `ve_faturamento=false`, logar como ele, e rodar query SQL direta no SQL Editor confirmando que `select * from lancamentos where tipo='Receita'` retorna 0 linhas.

## Estrutura de arquivos

```text
src/
  integrations/supabase/{client,types}.ts
  lib/{format,permissions,csv-hash}.ts
  contexts/auth-context.tsx
  components/
    layout/{Sidebar,Header,AuthLayout}.tsx
    lancamento/{LancamentoDialog,LancamentoRow,LancamentoDetail}.tsx
    dashboard/{KpiCards,LineChart,BarChart,CategoriaTable}.tsx
    ui/* (shadcn)
  routes/
    __root.tsx
    login.tsx
    _authenticated.tsx
    _authenticated/index.tsx          # dashboard
    _authenticated/razao.tsx
    _authenticated/a-revisar.tsx
    _authenticated/stone.tsx
    _authenticated/importacoes.tsx
    _authenticated/usuarios.tsx
supabase/policies.sql
README.md  (como rodar, como testar permissões)
```

## Detalhes técnicos

- Não vou usar `createServerFn` pois o backend é Supabase externo direto — todas as queries vão do browser via cliente Supabase com a anon key + RLS. Isso é seguro porque a segurança real fica no banco (Bloco 7).
- A única operação que precisa de service role é criar usuário no Auth (tela de Usuários). Tratada via Edge Function no seu Supabase OU gerando senha temporária e mandando reset por email — vou pedir sua preferência quando chegarmos lá.
- Para tabelas grandes (`lancamentos` 5.662 linhas) → sempre paginação server-side e `count: 'exact'` apenas quando necessário.

## O que vou pedir antes/depois de começar

1. `SUPABASE_URL` e `SUPABASE_ANON_KEY` (via secrets) para conectar.
2. Confirmar nomes/tipos de algumas colunas-chave (papel: string ou enum? `usuarios.email` existe?). Se possível, cole `\d+ usuarios`, `\d+ lancamentos`, `\d+ papeis` do psql, ou screenshot do Table Editor.

Quando o build terminar você roda os 6 testes que listou e me diz onde quebrou.
