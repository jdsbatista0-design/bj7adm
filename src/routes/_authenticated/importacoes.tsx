import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/importacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/fiscal/importacoes" });
  },
});
