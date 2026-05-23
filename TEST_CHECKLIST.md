# TEST_CHECKLIST — BJ7 Central

Checklist de verificação manual antes de deploiar mudanças. Executar com um usuário real no ambiente de preview.

## Pré-condições

- [ ] Usuário ativo na tabela `usuarios` com `ativo = true`
- [ ] Papel configurado com permissões adequadas (tabela `papeis`)
- [ ] Vínculo com pelo menos uma empresa em `usuario_empresas`

---

## Login (`/login`)

- [ ] Tela carrega sem erros
- [ ] Login com email/senha funciona e redireciona para `/`
- [ ] Email sem cadastro em `usuarios` exibe mensagem "Acesso não liberado"
- [ ] Logout funciona e volta para `/login`

---

## Home (`/`)

- [ ] Cards de navegação carregam
- [ ] Links funcionam (Financeiro, Empresas, Itens, Importações, Configurações)

---

## Hoje (`/hoje`)

- [ ] Alertas abertos aparecem nas seções corretas (atrasados, hoje, semana)
- [ ] Tarefas sem prazo aparecem na seção correspondente
- [ ] Botão "Resolver" funciona em alertas
- [ ] Botão "Soneca" funciona (24h)
- [ ] Estado vazio mostra mensagem adequada

---

## A Revisar (`/a-revisar`)

- [ ] Lançamentos não revisados aparecem
- [ ] Botão de edição abre o formulário correto
- [ ] Botão de marcar revisado funciona
- [ ] Usuário sem permissão `pode_marcar_revisado` não vê o botão
- [ ] Quando tudo revisado, exibe "Tudo revisado"

---

## Financeiro (`/financeiro`)

- [ ] Tab Lançamentos carrega com dados
- [ ] Filtros (ano, mês, tipo, empresa, unidade, categoria, busca) funcionam
- [ ] Filtros combinados retornam resultados corretos
- [ ] Tab Análise carrega gráficos e KPIs
- [ ] Usuário sem `ve_retiradas` não vê lançamentos tipo Retirada
- [ ] Usuário sem `ve_todas_empresas` vê apenas suas empresas

### DRE Consolidado (`/financeiro/dre-consolidado`)

- [ ] Tela carrega sem erro
- [ ] Dados de DRE visíveis (receita, despesa, EBITDA)

### Categorias (`/financeiro/categorias`)

- [ ] Lista carrega com contagem de lançamentos por categoria
- [ ] Criar nova categoria funciona
- [ ] Alerta de duplicata aparece para nome similar existente
- [ ] Excluir categoria com lançamentos mostra bloqueio
- [ ] Excluir categoria sem lançamentos funciona

---

## Documentos (`/documentos`)

- [ ] KPIs (ativos, vencidos, vencendo 30d, compromisso mensal) carregam
- [ ] Lista de documentos carrega
- [ ] Filtro por tipo funciona
- [ ] **Filtro por empresa:** selecionar empresa mostra apenas documentos dessa empresa (count e paginação devem bater)
- [ ] Filtro por status funciona
- [ ] Busca por título/contraparte funciona
- [ ] Paginação funciona (próxima/anterior, count correto em todas as páginas)
- [ ] Criar documento funciona (com arquivo e sem arquivo)
- [ ] Editar documento funciona
- [ ] Versões/aditivos: adicionar aditivo funciona
- [ ] Download de arquivo funciona

---

## Fiscal (`/fiscal/dashboard`)

- [ ] KPIs carregam (pendências semana, vencidas, concluídas, valor 30d)
- [ ] Monitor Simples Nacional exibe empresas e limites
- [ ] Calendário de obrigações (próximas 30d) carrega

### Fiscal — Pendências Contábeis (`/fiscal/pendencias`)

- [ ] Lista de pendências carrega
- [ ] Criar nova pendência funciona
- [ ] Filtros (status, direção, empresa, prioridade) funcionam
- [ ] Marcar como resolvida funciona
- [ ] Pendências vencidas aparecem destacadas em vermelho

### Fiscal — Importações (`/fiscal/importacoes`)

- [ ] Upload de CSV funciona
- [ ] Deduplicação funciona (re-importar mesmo arquivo não duplica)
- [ ] Histórico de importações aparece

---

## Cockpit — Itens (`/itens`)

- [ ] KPIs (hoje, semana, decisões, atrasados) carregam
- [ ] Tab Visão Geral mostra itens nas seções corretas
- [ ] Tab Tarefas — Kanban drag & drop funciona
- [ ] Tab Decisões mostra pendentes e decididas
- [ ] Tab Reuniões agrupa por data
- [ ] Tab Projetos exibe sub-itens com barra de progresso
- [ ] Tab Ideias — "Promover a Projeto" funciona
- [ ] Tab Eisenhower — quadrantes corretos
- [ ] Criar item funciona (todos os tipos)
- [ ] Editar item funciona
- [ ] Remover item pede confirmação e funciona

---

## Pessoas (`/pessoas`)

- [ ] 6 tabs carregam (Dashboard, Colaboradores, PDI, OKRs, 1:1, Rotina de Rua)
- [ ] Tab Colaboradores lista com hierarquia
- [ ] PDI — criar e editar plano funciona
- [ ] OKRs — ciclos e progresso visíveis

---

## Inteligência (`/inteligencia`)

- [ ] Lista de regras ativa/inativa carrega
- [ ] Toggle de regra funciona
- [ ] Botão "Rodar motor" executa `executar_regras()` e atualiza alertas
- [ ] Alertas aparecem com opções de resolver/snooze

---

## Open Finance (`/open-finance/conectar`)

- [ ] Tela carrega sem erro
- [ ] Lista de conexões existentes aparece com status
- [ ] Botão "Conectar conta bancária" abre widget Pluggy
- [ ] (Requer Edge Functions deployadas para conectar de fato)

---

## Stone (`/stone`)

- [ ] Acesso negado para usuário sem `ve_faturamento` ou permissão Stone
- [ ] Tab Notas Fiscais carrega
- [ ] Tab Evolução da Base carrega
- [ ] Tab Clientes Sumidos carrega
- [ ] Tab Apuração Rebate carrega com valores

---

## Operação (`/operacao`)

- [ ] Kanban carrega (Aberta, Em andamento, Aguardando)
- [ ] Criar nova tarefa funciona
- [ ] Mover tarefa entre colunas funciona
- [ ] Marcar tarefa como concluída funciona

---

## Comercial (`/comercial`)

- [ ] Cards de pipeline carregam (lead, oportunidade, proposta, followup)
- [ ] Criar lead funciona
- [ ] Marcar como concluído funciona

---

## Sistema BJ7 (`/sistema`)

### Templates (`/sistema/templates`)

- [ ] Templates listam corretamente
- [ ] Iniciar execução a partir de template funciona
- [ ] Clonar template funciona

### Execuções (`/sistema/execucoes`)

- [ ] Execuções em andamento carregam com progresso
- [ ] Modal de detalhe mostra etapas
- [ ] Marcar etapa como concluída funciona

---

## Configurações (`/config`)

- [ ] Cards de navegação aparecem conforme permissão
- [ ] Link para Usuários funciona
- [ ] Link para Importações funciona
- [ ] Link para Regras automáticas funciona

---

## Casos de borda

- [ ] Usuário sem nenhuma empresa vinculada — sem erro (listas vazias, não crash)
- [ ] Usuário sem papel — redirecionado ou mensagem clara
- [ ] Período sem dados financeiros — listas vazias sem crash
- [ ] Filtro por empresa sem documentos — lista vazia com count 0 (não página vazia enganosa)
- [ ] Sessão expirada — redireciona para login sem loop infinito
