import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthLayout } from "@/components/layout/AuthLayout";

export const Route = createFileRoute("/_authenticated")({
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
});
