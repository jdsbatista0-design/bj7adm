# BJ7 Central — Roteiro de testes

## 0. Pré-requisitos

1. Banco Supabase já populado (12 tabelas, ~14.9 mi receita / ~10.8 mi despesa).
2. Em **Auth → Users** do Supabase, criar 1 usuário por papel para testar:
   - `admin@bj7.test` (papel Admin)
   - `socio@bj7.test` (papel Sócio)
   - `gestor@bj7.test` (papel Gestor, sem `ve_faturamento`)
3. Em `public.usuarios`, garantir que cada e-mail tenha um registro com `papel_id` correto e `ativo=true`. O front vincula `auth_uid` automaticamente no primeiro login.

## 1. Login

- [ ] `/login` aceita as credenciais e redireciona para `/`.
- [ ] E-mail sem registro em `usuarios` → tela "Acesso não liberado".
- [ ] Logout limpa sessão e volta pra `/login`.

## 2. Sidebar / permissões

- [ ] **Admin** vê: Dashboard, Razão, Stone, Lançar, A Revisar, Importações, Usuários.
- [ ] **Sócio** vê: tudo menos Importações/Usuários (depende do papel).
- [ ] **Gestor** sem `ve_faturamento` NÃO vê Stone e NÃO vê o tipo "Receita" no Razão.

## 3. Razão (Bloco 3)

- [ ] Filtro por ano/mês/empresa/categoria funciona; URL atualiza com search params.
- [ ] Paginação 50/pg.
- [ ] Busca em descrição (ilike).
- [ ] Editar como Gestor: abre dialog em lançamento `revisado=false`, **bloqueia** em `revisado=true`.
- [ ] Marcar revisado (papel com `pode_marcar_revisado=true`).

## 4. Lançar (Bloco 5)

- [ ] `/lancar` abre o dialog.
- [ ] Salvar despesa nova → aparece em `/razao` com `revisado=false`, `contar_no_total=true`, `origem_classificacao='manual'`.
- [ ] Tipos exibidos no select respeitam `ve_faturamento` / `ve_retiradas`.

## 5. Stone (Bloco 4)

- [ ] Aba **Notas Fiscais** lista as últimas 500.
- [ ] Aba **Evolução** mostra qtd_clientes/novos/sumiram por mês.
- [ ] Aba **Sumidos** ordena por último lucro.
- [ ] Aba **Rebate** mostra alíquota como %.

## 6. Importações (Bloco 6)

- [ ] Upload de CSV com cabeçalhos: `data, tipo, empresa_id, unidade_id, categoria_id, subcategoria, descricao, valor, arquivo_origem, aba_origem, linha_origem`.
- [ ] Linhas inválidas aparecem na lista de erros.
- [ ] **Teste de hash (CRÍTICO)**: exporte 5 linhas existentes do banco em CSV, com `arquivo_origem`, `aba_origem`, `linha_origem`, `data`, `valor`, `descricao` originais. Reimporte. O resumo deve dizer `0 novos · 5 ignorados`. Se inserir tudo de novo, ajustar `src/lib/csv-hash.ts`.
- [ ] Histórico mostra a importação com inseridos/ignorados.

## 7. RLS (Bloco 7)

1. Vincule `auth_uid` para cada usuário antes de habilitar RLS:
   ```sql
   update public.usuarios
   set auth_uid = (select id from auth.users where email = usuarios.email)
   where auth_uid is null;
   ```
2. Cole `supabase/policies.sql` no SQL Editor do Supabase.
3. Re-teste como **Gestor sem `ve_faturamento`**: ele não deve conseguir nem `select` em `lancamentos` com tipo `Receita`, mesmo via REST direto.
4. Re-teste como **Gestor sem `ve_todas_empresas`** e sem nenhum vínculo em `usuario_empresas`: o Razão fica vazio.
5. Tentar `update` em `lancamentos` com `revisado=true` como Gestor → deve falhar.

## 8. KPIs do Dashboard (referência)

Receita ~14,9 mi / Despesa ~10,8 mi (consolidado histórico). Os números do Dashboard precisam bater com isso quando filtrado por "Todos os anos" / "Todas empresas" como Admin.
