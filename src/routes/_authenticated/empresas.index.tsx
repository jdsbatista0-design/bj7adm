import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paginateAll } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { AlertaRow, LancamentoRow, TarefaRow } from "@/integrations/supabase/database";
import { useEmpresas } from "@/hooks/use-refs";
import { useCurrentUser } from "@/contexts/auth-context";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, toLocalIsoDate } from "@/lib/format";
import { toast } from "sonner";
import { Building2, ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/empresas/")({
  component: EmpresasIndex,
});

const REGIMES = [
  "SEM_REGIME",
  "SIMPLES_ANEXO_I",
  "SIMPLES_ANEXO_II",
  "SIMPLES_ANEXO_III",
  "SIMPLES_ANEXO_IV",
  "SIMPLES_ANEXO_V",
  "LUCRO_PRESUMIDO",
  "LUCRO_REAL",
  "RET_SPE",
  "MEI",
  "IMUNE_ISENTA",
] as const;

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function EmpresasIndex() {
  const empresas = useEmpresas();
  const user = useCurrentUser();

  const startMonth = useMemo(() => {
    const d = new Date();
    return toLocalIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
  }, []);

  const lancQ = useQuery({
    queryKey: ["empresas-list", "lanc", startMonth, user.id],
    queryFn: async () => {
      if (!user.ve_todas_empresas && user.empresas_ids.length === 0) return [] as LancamentoRow[];
      return paginateAll<LancamentoRow>((fromIdx, toIdx) => {
        let q = supabase
          .from("lancamentos")
          .select("empresa_id,tipo,valor,contar_no_total,data")
          .gte("data", startMonth)
          .eq("contar_no_total", true)
          .in("tipo", ["Receita", "Despesa"]);
        if (!user.ve_todas_empresas) {
          q = q.in("empresa_id", user.empresas_ids);
        }
        return q.order("id", { ascending: true }).range(fromIdx, toIdx);
      });
    },
  });

  const alertasQ = useQuery({
    queryKey: ["empresas-list", "alertas"],
    queryFn: async () => {
      const r = await supabase.from("alertas").select("*").eq("status", "aberto").limit(500);
      if (r.error) throw r.error;
      return (r.data ?? []) as AlertaRow[];
    },
  });

  const tarefasQ = useQuery({
    queryKey: ["empresas-list", "tarefas"],
    queryFn: async () => {
      const r = await supabase
        .from("tarefas")
        .select("*")
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .limit(2000);
      if (r.error) throw r.error;
      return (r.data ?? []) as TarefaRow[];
    },
  });

  const por = useMemo(() => {
    const map = new Map<number, { rec: number; desp: number; alertas: number; tarefas: number }>();
    for (const l of (lancQ.data ?? []) as LancamentoRow[]) {
      const e = map.get(l.empresa_id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
      const v = Math.abs(Number(l.valor) || 0);
      if (l.tipo === "Receita") e.rec += v;
      else e.desp += v;
      map.set(l.empresa_id, e);
    }
    for (const a of alertasQ.data ?? []) {
      if (a.empresa_id == null) continue;
      const e = map.get(a.empresa_id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
      e.alertas += 1;
      map.set(a.empresa_id, e);
    }
    for (const t of tarefasQ.data ?? []) {
      if (t.empresa_id == null) continue;
      const e = map.get(t.empresa_id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
      e.tarefas += 1;
      map.set(t.empresa_id, e);
    }
    return map;
  }, [lancQ.data, alertasQ.data, tarefasQ.data]);

  return (
    <PageShell
      title="Empresas"
      description="Saúde, receita e items abertos por empresa do grupo"
      actions={<NovaEmpresaDialog />}
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(empresas.data ?? []).map((e) => {
          const a = por.get(e.id) ?? { rec: 0, desp: 0, alertas: 0, tarefas: 0 };
          const margem = a.rec > 0 ? ((a.rec - a.desp) / a.rec) * 100 : 0;
          return (
            <Link
              key={e.id}
              to="/empresas/$id"
              params={{ id: String(e.id) }}
              className="rounded-2xl bg-card p-4 ring-1 ring-white/5 hover:ring-primary/30 transition"
              style={{ boxShadow: "var(--shadow-elegant)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="text-sm font-semibold truncate">{e.nome}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Mini label="Receita mês" value={formatBRL(a.rec)} />
                <Mini label="Despesa mês" value={formatBRL(a.desp)} />
                <Mini label="Margem" value={a.rec > 0 ? `${margem.toFixed(0)}%` : "—"} />
                <Mini label="Items abertos" value={`${a.alertas + a.tarefas}`} />
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

function NovaEmpresaDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [regime, setRegime] = useState<string>("SEM_REGIME");

  const reset = () => { setNome(""); setCnpj(""); setRegime("SEM_REGIME"); };

  const m = useMutation({
    mutationFn: async () => {
      const nomeT = nome.trim();
      if (!nomeT) throw new Error("Nome é obrigatório");
      const ins = await supabase
        .from("empresas")
        .insert({ nome: nomeT, cnpj: cnpj.trim() || null } as never)
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      const empresaId = (ins.data as { id: number }).id;

      if (regime && regime !== "SEM_REGIME") {
        const r = await supabase
          .schema("fiscal")
          .from("regimes_empresas")
          .insert({
            empresa_id: empresaId,
            regime,
            data_inicio: new Date().toISOString().slice(0, 10),
          } as never);
        if (r.error) throw r.error;
      }
      return empresaId;
    },
    onSuccess: () => {
      toast.success("Empresa criada");
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["empresas-list"] });
      reset();
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao criar empresa"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova empresa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
          <DialogDescription>
            Cadastre uma empresa do grupo. Regime tributário é opcional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ne-nome">Nome*</Label>
            <Input id="ne-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ne-cnpj">CNPJ</Label>
            <Input
              id="ne-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(maskCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ne-regime">Regime tributário</Label>
            <Select value={regime} onValueChange={setRegime}>
              <SelectTrigger id="ne-regime"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGIMES.map((r) => (<SelectItem key={r} value={r}>{r.replaceAll("_", " ")}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "Criando..." : "Criar empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold tabular truncate">{value}</div>
    </div>
  );
}
