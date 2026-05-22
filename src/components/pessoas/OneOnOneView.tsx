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

type One = { id: number; gestor_id: number; liderado_id: number; data: string; topicos: string | null; acoes: string | null };

export default function OneOnOneView() {
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pessoas_one_on_ones"],
    queryFn: async (): Promise<One[]> => {
      const { data, error } = await supabase.from("pessoas_one_on_ones").select("*").order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as One[];
    },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<One>>({ data: new Date().toISOString().slice(0, 10) });
  const create = useMutation({
    mutationFn: async (v: Partial<One>) => { const { error } = await supabase.from("pessoas_one_on_ones").insert(v); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pessoas_one_on_ones"] }); setOpen(false); setForm({ data: new Date().toISOString().slice(0, 10) }); toast.success("1:1 registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { const { error } = await supabase.from("pessoas_one_on_ones").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pessoas_one_on_ones"] }),
  });

  const nameOf = (id: number) => colabs.find((c) => c.id === id)?.nome ?? "—";

  return (
    <PageShell title="1:1s" description="Reuniões de gestor com liderado" actions={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo 1:1</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar 1:1</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Gestor*</Label>
                <Select value={form.gestor_id ? String(form.gestor_id) : ""} onValueChange={(v) => setForm({ ...form, gestor_id: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Liderado*</Label>
                <Select value={form.liderado_id ? String(form.liderado_id) : ""} onValueChange={(v) => setForm({ ...form, liderado_id: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>{colabs.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Data*</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
            <div><Label>Tópicos</Label><Textarea value={form.topicos ?? ""} onChange={(e) => setForm({ ...form, topicos: e.target.value })} /></div>
            <div><Label>Ações combinadas</Label><Textarea value={form.acoes ?? ""} onChange={(e) => setForm({ ...form, acoes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => { if (!form.gestor_id || !form.liderado_id || !form.data) return toast.error("Preencha gestor, liderado e data"); create.mutate(form); }}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    }>
      <div className="border rounded-md">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Gestor</TableHead><TableHead>Liderado</TableHead><TableHead>Tópicos</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.data}</TableCell>
                <TableCell>{nameOf(r.gestor_id)}</TableCell>
                <TableCell>{nameOf(r.liderado_id)}</TableCell>
                <TableCell className="max-w-md"><div className="text-xs line-clamp-2">{r.topicos}</div></TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Remover 1:1?</AlertDialogTitle></AlertDialogHeader>
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
