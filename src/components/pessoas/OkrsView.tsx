import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useColaboradores } from "./ColaboradoresView";

type Okr = { id: number; ciclo: string; colaborador_id: number | null; objetivo: string; key_result: string; progresso: number; status: string };

function currentCiclo(): string {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export default function OkrsView() {
  const qc = useQueryClient();
  const { data: colabs = [] } = useColaboradores();
  const { data: okrs = [], isLoading } = useQuery({
    queryKey: ["pessoas_okrs"],
    queryFn: async (): Promise<Okr[]> => {
      const { data, error } = await supabase.from("pessoas_okrs").select("*").order("ciclo", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Okr[];
    },
  });
  const ciclos = useMemo(() => Array.from(new Set([currentCiclo(), ...okrs.map((o) => o.ciclo)])), [okrs]);
  const [ciclo, setCiclo] = useState(currentCiclo());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Okr>>({ ciclo: currentCiclo(), progresso: 0, status: "em_andamento" });

  const create = useMutation({
    mutationFn: async (v: Partial<Okr>) => { const { error } = await supabase.from("pessoas_okrs").insert(v); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pessoas_okrs"] }); setOpen(false); setForm({ ciclo: currentCiclo(), progresso: 0, status: "em_andamento" }); toast.success("OKR criado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateProg = useMutation({
    mutationFn: async ({ id, progresso }: { id: number; progresso: number }) => {
      const { error } = await supabase.from("pessoas_okrs").update({ progresso, status: progresso >= 100 ? "concluido" : "em_andamento", atualizado_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pessoas_okrs"] }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { const { error } = await supabase.from("pessoas_okrs").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pessoas_okrs"] }); toast.success("Removido"); },
  });

  const filtered = okrs.filter((o) => o.ciclo === ciclo);

  return (
    <PageShell title="OKRs" description="Objetivos e Resultados-Chave" actions={
      <div className="flex gap-2 items-center">
        <Select value={ciclo} onValueChange={setCiclo}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{ciclos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo OKR</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo OKR</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Ciclo* (ex: 2026-Q1)</Label><Input value={form.ciclo ?? ""} onChange={(e) => setForm({ ...form, ciclo: e.target.value })} /></div>
              <div><Label>Colaborador (opcional)</Label>
                <Select value={form.colaborador_id ? String(form.colaborador_id) : "none"} onValueChange={(v) => setForm({ ...form, colaborador_id: v === "none" ? null : Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— OKR de empresa —</SelectItem>{colabs.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Objetivo*</Label><Input value={form.objetivo ?? ""} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} /></div>
              <div><Label>Key Result*</Label><Input value={form.key_result ?? ""} onChange={(e) => setForm({ ...form, key_result: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => { if (!form.ciclo || !form.objetivo || !form.key_result) return toast.error("Preencha ciclo, objetivo e KR"); create.mutate(form); }}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    }>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum OKR neste ciclo.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((o) => (
          <Card key={o.id}>
            <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-sm">{o.objetivo}</CardTitle>
                <div className="text-xs text-muted-foreground mt-1">{o.colaborador_id ? colabs.find((c) => c.id === o.colaborador_id)?.nome : "Empresa"}</div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Remover OKR?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(o.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">KR: {o.key_result}</div>
              <div className="flex items-center gap-2">
                <Progress value={Number(o.progresso)} className="flex-1" />
                <Input type="number" min={0} max={100} className="w-20 h-8" defaultValue={o.progresso}
                  onBlur={(e) => { const v = Math.max(0, Math.min(100, Number(e.target.value))); if (v !== Number(o.progresso)) updateProg.mutate({ id: o.id, progresso: v }); }} />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
