import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/components/layout/AuthLayout";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});
