import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Banco em Oregon — cada round-trip custa ~190ms.
        // Reaproveitar cache agressivamente é o maior ganho de UX.
        staleTime: 5 * 60 * 1000,       // 5 min: não refetcha ao revisitar a página
        gcTime: 30 * 60 * 1000,         // 30 min em memória
        refetchOnWindowFocus: false,    // não refetcha ao voltar pra aba
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
