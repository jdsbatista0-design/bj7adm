import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { NotaRapidaRow } from "@/integrations/supabase/database";
import { useEmpresas } from "@/hooks/use-refs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pin, PinOff, Archive, ArchiveRestore, Trash2, Plus, Sparkles,
  Lightbulb, Bell, Search, Pencil, Check, X, CheckSquare, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "nota",     label: "Nota",     icon: Sparkles },
  { value: "ideia",    label: "Ideia",    icon: Lightbulb },
  { value: "lembrete", label: "Lembrete", icon: Bell },
];

type View = "inbox" | "arquivadas";

export function NotasRapidasDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const empresas = useEmpresas();

  const [conteudo, setConteudo] = useState("");
  const [tipo, setTipo] = useState("nota");
  const [empresaId, setEmpresaId] = useState("0");
  const [view, setView] = useState<View>("inbox");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const q = useQuery({
    queryKey: ["notas_rapidas", view],
    queryFn: async () => {
      const r = await from("notas_rapidas")
        .select("*")
        .eq("arquivada", view === "arquivadas")
        .order("fixada", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(200);
      if (r.error) throw r.error;
      return asRows("notas_rapidas", r.data);
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return q.data ?? [];
    return (q.data ?? []).filter(n => n.conteudo.toLowerCase().includes(s));
  }, [q.data, search]);

  const empresaNome = (id: number | null) =>
    id ? empresas.data?.find(e => e.id === id)?.nome ?? `#${id}` : null;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notas_rapidas"] });

  const create = useMutation({
    mutationFn: async () => {
      if (!conteudo.trim()) return;
      const r = await supabase.from("notas_rapidas").insert({
        conteudo: conteudo.trim(),
        tipo,
        empresa_id: empresaId !== "0" ? Number(empresaId) : null,
        fixada: false,
        arquivada: false,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => { setConteudo(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateContent = useMutation({
    mutationFn: async ({ id, conteudo }: { id: number; conteudo: string }) => {
      const r = await supabase.from("notas_rapidas").update({ conteudo }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => { setEditingId(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEmpresa = useMutation({
    mutationFn: async ({ id, empresa_id }: { id: number; empresa_id: number | null }) => {
      const r = await supabase.from("notas_rapidas").update({ empresa_id }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: invalidate,
  });

  const togglePin = useMutation({
    mutationFn: async (n: NotaRapidaRow) => {
      const r = await supabase.from("notas_rapidas").update({ fixada: !n.fixada }).eq("id", n.id);
      if (r.error) throw r.error;
    },
    onSuccess: invalidate,
  });

  const toggleArchive = useMutation({
    mutationFn: async (n: NotaRapidaRow) => {
      const r = await supabase.from("notas_rapidas").update({ arquivada: !n.arquivada }).eq("id", n.id);
      if (r.error) throw r.error;
    },
    onSuccess: invalidate,
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await supabase.from("notas_rapidas").delete().eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: invalidate,
  });

  const toTarefa = useMutation({
    mutationFn: async (n: NotaRapidaRow) => {
      const titulo = n.conteudo.split("\n")[0].slice(0, 120);
      const r = await supabase.from("tarefas").insert({
        titulo,
        descricao: n.conteudo,
        empresa_id: n.empresa_id,
        prioridade: "media",
        status: "aberta",
        origem: "manual",
      });
      if (r.error) throw r.error;
      const r2 = await supabase.from("notas_rapidas").update({ arquivada: true }).eq("id", n.id);
      if (r2.error) throw r2.error;
    },
    onSuccess: () => { toast.success("Nota convertida em tarefa"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Notas rápidas</SheetTitle>
          <SheetDescription>Inbox de ideias, notas e lembretes — capture rápido, vire tarefa depois.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 px-4 space-y-3">
          <div className="rounded-xl bg-card p-3 ring-1 ring-white/5 space-y-2">
            <Textarea
              placeholder="Escreva algo..."
              value={conteudo}
              onChange={e => setConteudo(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  create.mutate();
                }
              }}
              rows={3}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem empresa</SelectItem>
                  {empresas.data?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex-1" />
              <Button size="sm" onClick={() => create.mutate()} disabled={!conteudo.trim() || create.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">⌘/Ctrl + Enter para salvar</p>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as View)} className="flex-1">
              <TabsList className="h-8">
                <TabsTrigger value="inbox" className="text-xs h-6">Inbox</TabsTrigger>
                <TabsTrigger value="arquivadas" className="text-xs h-6">Arquivadas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-8 pl-7 text-sm"
            />
          </div>

          <div className="space-y-2">
            {q.isLoading ? (
              <><Skeleton className="h-16" /><Skeleton className="h-16" /></>
            ) : filtered.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-white/5 rounded-xl">
                {search ? "Nada encontrado" : view === "inbox" ? "Inbox vazio" : "Nenhuma arquivada"}
              </div>
            ) : (
              filtered.map(n => {
                const Meta = TIPOS.find(t => t.value === n.tipo) ?? TIPOS[0];
                const Icon = Meta.icon;
                const isEditing = editingId === n.id;
                const empNome = empresaNome(n.empresa_id);
                return (
                  <div key={n.id} className={cn("rounded-xl bg-card p-3 ring-1 ring-white/5", n.fixada && "ring-primary/40")}>
                    <div className="flex items-start gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      {isEditing ? (
                        <div className="flex-1 space-y-2">
                          <Textarea
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            rows={3}
                            autoFocus
                          />
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateContent.mutate({ id: n.id, conteudo: editText.trim() })}
                              disabled={!editText.trim() || updateContent.isPending}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 text-sm whitespace-pre-wrap break-words">{n.conteudo}</div>
                      )}
                    </div>
                    {!isEditing && (
                      <>
                        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="uppercase">{Meta.label}</span>
                            {empNome && (
                              <>
                                <span>·</span>
                                <Building2 className="h-2.5 w-2.5" />
                                <span className="truncate max-w-[120px]">{empNome}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button size="sm" variant="ghost" title="Converter em tarefa" onClick={() => toTarefa.mutate(n)}>
                              <CheckSquare className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditingId(n.id); setEditText(n.conteudo); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" title={n.fixada ? "Desafixar" : "Fixar"} onClick={() => togglePin.mutate(n)}>
                              {n.fixada ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" title={n.arquivada ? "Desarquivar" : "Arquivar"} onClick={() => toggleArchive.mutate(n)}>
                              {n.arquivada ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="ghost" title="Excluir" onClick={() => del.mutate(n.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-1.5">
                          <Select
                            value={n.empresa_id ? String(n.empresa_id) : "0"}
                            onValueChange={(v) => updateEmpresa.mutate({ id: n.id, empresa_id: v === "0" ? null : Number(v) })}
                          >
                            <SelectTrigger className="h-6 text-[10px] text-muted-foreground border-dashed">
                              <SelectValue placeholder="Vincular empresa" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Sem empresa</SelectItem>
                              {empresas.data?.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
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
