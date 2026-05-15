import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LancamentoDialog, useLancamentoDialog } from "@/components/lancamento/LancamentoDialog";
import { useCurrentUser } from "@/contexts/auth-context";
import { podeLancar } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/lancar")({
  component: LancarPage,
});

function LancarPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const dlg = useLancamentoDialog();

  useEffect(() => {
    if (!podeLancar(user)) return;
    dlg.openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!podeLancar(user)) {
    return <div className="p-6 text-sm text-destructive">Seu papel não permite criar lançamentos.</div>;
  }

  return (
    <div className="p-6">
      <LancamentoDialog
        open={dlg.open}
        onOpenChange={(o) => {
          dlg.setOpen(o);
          if (!o) void navigate({ to: "/razao" });
        }}
        lancamento={null}
      />
      <p className="text-sm text-muted-foreground">Abrindo formulário...</p>
    </div>
  );
}
