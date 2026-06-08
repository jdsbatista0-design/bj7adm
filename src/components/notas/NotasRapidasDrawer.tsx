import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { NotaRapidaRow } from "@/integrations/supabase/database";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Pin, PinOff, Archive, Trash2, Plus, Sparkles, Lightbulb, Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "nota",     label: "Nota",     icon: Sparkles },
  { value: "ideia",    label: "Ideia",    icon: Lightbulb },
  { value: "lembrete", label: "Lembrete", icon: Bell },
];

export function NotasRapidasDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState("nota");

  const q = useQuery({
    queryKey: ["notas_rapidas"],
    queryFn: async () => {
      const r = await from("notas_rapidas")
        .select("*")
        .eq("arquivada", false)
        .order("fixada", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(100);
      if (r.error) throw r.error;
      return asRows("notas_rapidas", r.data);
    },
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!conteudo.trim()) return;
      const r = await supabase.from("notas_rapidas").insert({
        conteudo: conteudo.trim(),
        tipo,
        fixada: false,
        arquivada: false,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      setConteudo("");
      qc.invalidateQueries({ queryKey: ["notas_rapidas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePin = useMutation({
    mutationFn: async (n: NotaRapidaRow) => {
      const r = await supabase.from("notas_rapidas").update({ fixada: !n.fixada }).eq("id", n.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notas_rapidas"] }),
  });

  const archive = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("notas_rapidas").update({ arquivada: true }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notas_rapidas"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("notas_rapidas").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notas_rapidas"] }),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Notas rápidas</SheetTitle>
          <SheetDescription>Inbox de ideias, notas e lembretes — capture rápido e organize depois.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-4 space-y-3">
          <div className="rounded-xl bg-card p-3 ring-1 ring-white/5 space-y-2">
            <Textarea
              placeholder="Escreva algo..."
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              rows={3}
            />
            <div className="flex items-center gap-2">
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button size="sm" onClick={() => create.mutate()} disabled={!conteudo.trim() || create.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {q.isLoading ? (
              <><Skeleton className="h-16" /><Skeleton className="h-16" /></>
            ) : (q.data?.length ?? 0) === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-white/5 rounded-xl">
                Inbox vazio
              </div>
            ) : (
              q.data!.map(n => {
                const Meta = TIPOS.find(t => t.value === n.tipo) ?? TIPOS[0];
                const Icon = Meta.icon;
                return (
                  <div key={n.id} className={cn("rounded-xl bg-card p-3 ring-1 ring-white/5", n.fixada && "ring-primary/40")}>
                    <div className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 text-sm whitespace-pre-wrap">{n.conteudo}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase">{Meta.label}</span>
                      <div className="flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" onClick={() => togglePin.mutate(n)}>
                          {n.fixada ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => archive.mutate(n.id)}>
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => del.mutate(n.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
