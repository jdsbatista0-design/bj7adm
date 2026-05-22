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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useColaboradores } from "./ColaboradoresView";

type Visita = { id: number; colaborador_id: number; data: string; local: string | null; cliente: string | null; observacoes: string | null };

export default function RotinaRuaView() {
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pessoas_rotina_rua"],
    queryFn: async (): Promise<Visita[]> => {
      const { data, error } = await supabase.from("pessoas_rotina_rua").select("*").order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Visita[];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Visita>>({ data: new Date().toISOString().slice(0, 10) });
  const create = useMutation({
    mutationFn: async (v: Partial<Visita>) => { const { error } = await supabase.from("pessoas_rotina_rua").insert(v); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pessoas_rotina_rua"] }); setOpen(false); setForm({ data: new Date().toISOString().slice(0, 10) }); toast.success("Visita registrada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { const { error } = await supabase.from("pessoas_rotina_rua").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pessoas_rotina_rua"] }),
  });

  return (
    <PageShell title="Rotina de Rua" description="Visitas e atendimentos externos" actions={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Nova visita</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar visita</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Colaborador*</Label>
              <Select value={form.colaborador_id ? String(form.colaborador_id) : ""} onValueChange={(v) => setForm({ ...form, colaborador_id: Number(v) })}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Data*</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div><Label>Cliente</Label><Input value={form.cliente ?? ""} onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></div>
            </div>
            <div><Label>Local</Label><Input value={form.local ?? ""} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => { if (!form.colaborador_id || !form.data) return toast.error("Colaborador e data obrigatórios"); create.mutate(form); }}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Colaborador</TableHead><TableHead>Cliente</TableHead><TableHead>Local</TableHead><TableHead>Obs.</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma visita</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.data}</TableCell>
                <TableCell>{colabs.find((c) => c.id === r.colaborador_id)?.nome ?? "—"}</TableCell>
                <TableCell>{r.cliente}</TableCell>
                <TableCell>{r.local}</TableCell>
                <TableCell className="max-w-xs"><div className="text-xs line-clamp-2">{r.observacoes}</div></TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Remover visita?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(r.id)}>Remover</AlertDialogAction></AlertDialogFooter>
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
