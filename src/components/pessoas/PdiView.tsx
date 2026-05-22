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
import { Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useColaboradores } from "./ColaboradoresView";

type Pdi = { id: number; colaborador_id: number; titulo: string; descricao: string | null; prazo: string | null; status: string };
const STATUS = ["aberto", "em_andamento", "concluido", "cancelado"] as const;
const STATUS_LABEL: Record<string, string> = { aberto: "Aberto", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };

export default function PdiView() {
  const { data: colabs = [] } = useColaboradores();
  const qc = useQueryClient();
  const { data: pdis = [], isLoading } = useQuery({
    queryKey: ["pessoas_pdis"],
    queryFn: async (): Promise<Pdi[]> => {
      const { data, error } = await supabase.from("pessoas_pdis").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pdi[];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Pdi>>({ status: "aberto" });

  const create = useMutation({
    mutationFn: async (v: Partial<Pdi>) => {
      const { error } = await supabase.from("pessoas_pdis").insert(v);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pessoas_pdis"] }); setOpen(false); setForm({ status: "aberto" }); toast.success("PDI criado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { error } = await supabase.from("pessoas_pdis").update({ status, atualizado_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pessoas_pdis"] }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { const { error } = await supabase.from("pessoas_pdis").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pessoas_pdis"] }); toast.success("Removido"); },
  });

  return (
    <PageShell title="PDI" description="Planos de Desenvolvimento Individual" actions={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo PDI</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo PDI</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Colaborador*</Label>
              <Select value={form.colaborador_id ? String(form.colaborador_id) : ""} onValueChange={(v) => setForm({ ...form, colaborador_id: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Título*</Label><Input value={form.titulo ?? ""} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><Label>Prazo</Label><Input type="date" value={form.prazo ?? ""} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => { if (!form.colaborador_id || !form.titulo) return toast.error("Colaborador e título obrigatórios"); create.mutate(form); }}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead>Colaborador</TableHead><TableHead>Título</TableHead><TableHead>Prazo</TableHead><TableHead>Status</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && pdis.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum PDI</TableCell></TableRow>}
            {pdis.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{colabs.find((c) => c.id === p.colaborador_id)?.nome ?? "—"}</TableCell>
                <TableCell><div className="font-medium">{p.titulo}</div>{p.descricao && <div className="text-xs text-muted-foreground line-clamp-1">{p.descricao}</div>}</TableCell>
                <TableCell>{p.prazo ?? "—"}</TableCell>
                <TableCell>
                  <Select value={p.status} onValueChange={(v) => update.mutate({ id: p.id, status: v })}>
                    <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Remover PDI?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(p.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-2"><Badge variant="secondary">{pdis.length} no total</Badge></div>
    </PageShell>
  );
}
