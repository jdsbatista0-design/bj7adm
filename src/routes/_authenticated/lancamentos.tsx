import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  beforeLoad: () => {
    throw redirect({
      to: "/financeiro",
      search: { tab: "lancamentos" } as never,
      replace: true,
    });
  },
});
