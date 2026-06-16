## Problema
A rota pai `/stone` (`src/routes/_authenticated/stone.tsx`) renderiza conteúdo próprio com tabs internas (Notas Fiscais, Evolução, etc.), mas ela **também é pai** das rotas filhas `/stone/importacoes` e `/stone/importar-rebate`. No TanStack Router, uma rota que tem filhos deve ser um layout com `<Outlet />`; caso contrário, o comportamento de navegação para as rotas filhas fica imprevisível e pode fazer com que ambas abram o mesmo conteúdo.

## Solução
1. Transformar `src/routes/_authenticated/stone.tsx` em um layout puro (apenas `<Outlet />` + eventual wrapper/título).
2. Mover o conteúdo atual de `stone.tsx` (tabs de Notas, Evolução, Sumidos, Rebate) para uma nova rota `src/routes/_authenticated/stone.index.tsx`, que será a página inicial ao acessar `/stone`.
3. Garantir que o menu lateral continue apontando para `/stone/importacoes` e `/stone/importar-rebate` (já está correto).
4. Permitir que o Vite/TanStack Router regenere o `routeTree.gen.ts` automaticamente após a mudança.

Isso separa o layout da página inicial e faz com que as rotas filhas sejam renderizadas corretamente, sem colidir com o conteúdo da rota pai.

## Arquivos afetados
- `src/routes/_authenticated/stone.tsx` — vira layout com Outlet
- `src/routes/_authenticated/stone.index.tsx` — novo, recebe o conteúdo atual de stone.tsx
- `src/routeTree.gen.ts` — regenerado automaticamente pelo plugin