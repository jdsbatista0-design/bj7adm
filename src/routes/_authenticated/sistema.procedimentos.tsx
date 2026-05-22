import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresas } from "@/hooks/use-refs";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Play, Search, Workflow, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sistema/procedimentos")({
  component: SistemaProcedimentos,
});

type Proc = {
  id: number; codigo: string | null; titulo: string; descricao: string | null;
  eixo_bj7: string | null; empresa_id: number | null; status: string;
  categoria: string | null; conteudo: string | null; created_at: string | null;
};
type DashRow = {
  id: number; codigo: string | null; titulo: string; eixo_bj7: string | null;
  status: string | null; empresa: string | null; total_etapas: number | null;
  execucoes_concluidas: number | null; execucoes_em_andamento: number | null;
  ultima_execucao: string | null; responsaveis: string | null;
};

const EIXOS = ["PESSOAS", "PROCESSOS", "PRODUTO", "CLIENTE", "FINANCEIRO", "MARKETING", "ESTRATEGIA"];
const STATUS = ["ATIVO", "RASCUNHO", "ARQUIVADO", "TEMPLATE"];

const sb = () => supabase.schema("sistema" as never);

export default function SistemaProcedimentos() {
  const qc = useQueryClient();
  const empresasQ = useEmpresas();
  const [search, setSearch] = useState("");
  const [eixo, setEixo] = useState<string>("");
  const [statusF, setStatusF] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Proc | null>(null);

  const dashQ = useQuery({
    queryKey: ["sistema:proc-dashboard"],
    queryFn: async () => {
      const r = await sb().from("v_procedimentos_dashboard").select("*").order("titulo");
      if (r.error) throw r.error;
      return (r.data ?? []) as DashRow[];
    },
  });

  const filtered = useMemo(() => {
    const items = dashQ.data ?? [];
    const s = search.trim().toLowerCase();
    return items.filter((d) =>
      (!eixo || d.eixo_bj7 === eixo) &&
      (!statusF || d.status === statusF) &&
      (!s || `${d.titulo} ${d.codigo ?? ""} ${d.empresa ?? ""}`.toLowerCase().includes(s)),
    );
  }, [dashQ.data, search, eixo, statusF]);

  const saveM = useMutation({
    mutationFn: async (p: Partial<Proc>) => {
      if (editing?.id) {
        const r = await sb().from("procedimentos").update(p).eq("id", editing.id);
        if (r.error) throw r.error;
      } else {
        const r = await sb().from("procedimentos").insert(p);
        if (r.error) throw r.error;
      }
    },
    onSuccess: () => {
      toast.success("Procedimento salvo");
      setOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["sistema:proc-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startM = useMutation({
    mutationFn: async (procId: number) => {
      const r = await sb().rpc("iniciar_execucao", { p_procedimento_id: procId });
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => {
      toast.success("Execução iniciada");
      qc.invalidateQueries({ queryKey: ["sistema:proc-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell
      title="Procedimentos (BJ7)"
      description="Catálogo de procedimentos operacionais por eixo"
      actions={
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo
        </Button>
      }
    >
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={eixo || "_all"} onValueChange={(v) => setEixo(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Eixo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os eixos</SelectItem>
              {EIXOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusF || "_all"} onValueChange={(v) => setStatusF(v === "_all" ? "" : v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {dashQ.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Workflow className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhum procedimento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Eixo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-center">Etapas</TableHead>
                  <TableHead className="text-center">Andamento</TableHead>
                  <TableHead className="text-center">Concluídas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.codigo ?? "—"}</TableCell>
                    <TableCell className="font-medium">{d.titulo}</TableCell>
                    <TableCell>{d.eixo_bj7 ? <Badge variant="secondary">{d.eixo_bj7}</Badge> : "—"}</TableCell>
                    <TableCell className="text-sm">{d.empresa ?? "—"}</TableCell>
                    <TableCell className="text-center">{d.total_etapas ?? 0}</TableCell>
                    <TableCell className="text-center">{d.execucoes_em_andamento ?? 0}</TableCell>
                    <TableCell className="text-center">{d.execucoes_concluidas ?? 0}</TableCell>
                    <TableCell><Badge variant={d.status === "ATIVO" ? "default" : "outline"}>{d.status ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => startM.mutate(d.id)} disabled={startM.isPending}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const r = await sb().from("procedimentos").select("*").eq("id", d.id).single();
                        if (r.error) { toast.error(r.error.message); return; }
                        setEditing(r.data as Proc); setOpen(true);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProcFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        empresas={(empresasQ.data ?? []) as Array<{ id: number; nome: string }>}
        onSubmit={(p) => saveM.mutate(p)}
        saving={saveM.isPending}
      />
    </PageShell>
  );
}

function ProcFormDialog({
  open, onOpenChange, initial, empresas, onSubmit, saving,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  initial: Proc | null;
  empresas: Array<{ id: number; nome: string }>;
  onSubmit: (p: Partial<Proc>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Proc>>({});
  useMemo(() => { setForm(initial ?? { status: "ATIVO" }); }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Código</Label>
              <Input value={form.codigo ?? ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.categoria ?? ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Eixo BJ7</Label>
              <Select value={form.eixo_bj7 ?? ""} onValueChange={(v) => setForm({ ...form, eixo_bj7: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{EIXOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa</Label>
              <Select
                value={form.empresa_id ? String(form.empresa_id) : ""}
                onValueChange={(v) => setForm({ ...form, empresa_id: v ? Number(v) : null })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "ATIVO"} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Conteúdo (markdown / instruções)</Label>
            <Textarea rows={6} value={form.conteudo ?? ""} onChange={(e) => setForm({ ...form, conteudo: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={saving || !form.titulo}
            onClick={() => onSubmit(form)}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
