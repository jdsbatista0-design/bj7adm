import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export type Colaborador = {
  id: number;
  nome: string;
  email: string | null;
  cargo: string | null;
  area: string | null;
  gestor_id: number | null;
  data_admissao: string | null;
  ativo: boolean;
  observacoes: string | null;
};

export function useColaboradores() {
  return useQuery({
    queryKey: ["pessoas_colaboradores"],
    queryFn: async (): Promise<Colaborador[]> => {
      const { data, error } = await supabase
        .from("pessoas_colaboradores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Colaborador[];
    },
  });
}

export default function ColaboradoresView() {
  const { data: colabs = [], isLoading } = useColaboradores();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Colaborador | null>(null);

  const upsert = useMutation({
    mutationFn: async (input: Partial<Colaborador> & { id?: number }) => {
      const payload = { ...input, atualizado_em: new Date().toISOString() };
      if (input.id) {
        const { error } = await supabase.from("pessoas_colaboradores").update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pessoas_colaboradores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pessoas_colaboradores"] });
      qc.invalidateQueries({ queryKey: ["pessoas_dashboard"] });
      setOpen(false); setEdit(null);
      toast.success("Colaborador salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("pessoas_colaboradores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pessoas_colaboradores"] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = colabs.filter((c) =>
    !q || `${c.nome} ${c.email ?? ""} ${c.cargo ?? ""} ${c.area ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <PageShell
      title="Colaboradores"
      description="Gerencie pessoas do time"
      actions={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo</Button>
          </DialogTrigger>
          <ColabDialog initial={edit} colabs={colabs} onSubmit={(v) => upsert.mutate(v)} />
        </Dialog>
      }
    >
      <Input placeholder="Buscar por nome, e-mail, cargo, área…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum colaborador</TableCell></TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}<div className="text-xs text-muted-foreground">{c.email}</div></TableCell>
                <TableCell>{c.cargo}</TableCell>
                <TableCell>{c.area}</TableCell>
                <TableCell>{colabs.find((x) => x.id === c.gestor_id)?.nome ?? "—"}</TableCell>
                <TableCell>{c.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                <TableCell className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Remover {c.nome}?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita. PDIs, OKRs e 1:1s associados serão removidos.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(c.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  );
}

function ColabDialog({ initial, colabs, onSubmit }: { initial: Colaborador | null; colabs: Colaborador[]; onSubmit: (v: Partial<Colaborador> & { id?: number }) => void }) {
  const [form, setForm] = useState<Partial<Colaborador>>(initial ?? { ativo: true });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div><Label>Nome*</Label><Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>E-mail</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Admissão</Label><Input type="date" value={form.data_admissao ?? ""} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Cargo</Label><Input value={form.cargo ?? ""} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
          <div><Label>Área</Label><Input value={form.area ?? ""} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
        </div>
        <div>
          <Label>Gestor</Label>
          <Select value={form.gestor_id ? String(form.gestor_id) : "none"} onValueChange={(v) => setForm({ ...form, gestor_id: v === "none" ? null : Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem gestor —</SelectItem>
              {colabs.filter((c) => c.id !== initial?.id).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => { if (!form.nome) return toast.error("Nome obrigatório"); onSubmit(form); }}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
