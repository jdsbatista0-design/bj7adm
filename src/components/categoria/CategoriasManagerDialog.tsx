import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { from, asRows } from "@/integrations/supabase/db";
import { supabase } from "@/integrations/supabase/client";
import type { CategoriaRow } from "@/integrations/supabase/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const TIPOS = ["Receita", "Despesa", "Retirada", "Empréstimo"] as const;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

// Levenshtein distance for fuzzy similarity
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[b.length];
}

function findSimilar(name: string, existing: CategoriaRow[]): CategoriaRow | null {
  const n = normalize(name);
  if (!n) return null;
  for (const c of existing) {
    const cn = normalize(c.nome);
    if (cn === n) return c;
    // contém ou é contido (com ao menos 4 chars)
    if (n.length >= 4 && cn.length >= 4 && (cn.includes(n) || n.includes(cn))) return c;
    // distância pequena
    const d = levenshtein(n, cn);
    const maxLen = Math.max(n.length, cn.length);
    if (maxLen >= 5 && d <= 2) return c;
  }
  return null;
}

export function CategoriasManagerDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<string>("Despesa");
  const [novoGrupo, setNovoGrupo] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<CategoriaRow | null>(null);

  const cats = useQuery({
    queryKey: ["categorias-manager"],
    queryFn: async () => {
      const r = await from("categorias").select("*").order("nome");
      if (r.error) throw r.error;
      return asRows("categorias", r.data);
    },
    enabled: open,
  });

  const counts = useQuery({
    queryKey: ["categorias-counts"],
    queryFn: async () => {
      // pega contagem por categoria via RPC simples: select categoria_id, count
      const r = await supabase
        .from("lancamentos")
        .select("categoria_id", { count: "exact", head: false })
        .limit(100000);
      if (r.error) throw r.error;
      const map = new Map<number, number>();
      (r.data as { categoria_id: number | null }[]).forEach((row) => {
        if (row.categoria_id != null) {
          map.set(row.categoria_id, (map.get(row.categoria_id) ?? 0) + 1);
        }
      });
      return map;
    },
    enabled: open,
  });

  const grupos = useMemo(() => {
    const s = new Set<string>();
    (cats.data ?? []).forEach((c) => c.grupo && s.add(c.grupo));
    return Array.from(s).sort();
  }, [cats.data]);

  const filtered = useMemo(() => {
    const f = normalize(filter);
    const list = cats.data ?? [];
    if (!f) return list;
    return list.filter((c) => normalize(c.nome).includes(f));
  }, [cats.data, filter]);

  const createMut = useMutation({
    mutationFn: async () => {
      const nome = novoNome.trim();
      if (!nome) throw new Error("Informe o nome");
      const similar = findSimilar(nome, cats.data ?? []);
      if (similar) {
        throw new Error(`Já existe categoria parecida: "${similar.nome}"`);
      }
      const r = await from("categorias")
        .insert({
          nome: nome.toUpperCase(),
          tipo_predominante: novoTipo || null,
          grupo: novoGrupo.trim() || null,
        })
        .select("*")
        .single();
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => {
      toast.success("Categoria criada");
      setNovoNome("");
      setNovoGrupo("");
      qc.invalidateQueries({ queryKey: ["categorias-manager"] });
      qc.invalidateQueries({ queryKey: ["categorias"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: async (c: CategoriaRow) => {
      const used = counts.data?.get(c.id) ?? 0;
      if (used > 0) {
        throw new Error(`Categoria em uso (${used} lançamento(s)). Não pode excluir.`);
      }
      const r = await from("categorias").delete().eq("id", c.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Categoria excluída");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["categorias-manager"] });
      qc.invalidateQueries({ queryKey: ["categorias"] });
      qc.invalidateQueries({ queryKey: ["categorias-counts"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const similarPreview = useMemo(() => {
    if (!novoNome.trim()) return null;
    return findSimilar(novoNome, cats.data ?? []);
  }, [novoNome, cats.data]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar categorias</DialogTitle>
            <DialogDescription>
              Crie novas categorias ou exclua as que não estão sendo usadas.
            </DialogDescription>
          </DialogHeader>

          {/* Criar nova */}
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="text-sm font-medium">Nova categoria</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_160px_auto] gap-2">
              <Input
                placeholder="Nome (ex: MARKETING)"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder="Grupo (opcional)"
                value={novoGrupo}
                onChange={(e) => setNovoGrupo(e.target.value)}
                list="grupos-list"
              />
              <datalist id="grupos-list">
                {grupos.map((g) => <option key={g} value={g} />)}
              </datalist>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!novoNome.trim() || !!similarPreview || createMut.isPending}
              >
                <Plus className="h-4 w-4 mr-1" /> Criar
              </Button>
            </div>
            {similarPreview && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Já existe categoria parecida: <span className="font-semibold">{similarPreview.nome}</span>
              </div>
            )}
          </div>

          {/* Lista */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar categoria..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {filtered.length} / {cats.data?.length ?? 0}
            </div>
          </div>

          <div className="flex-1 overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2 font-medium">Nome</th>
                  <th className="p-2 font-medium">Tipo</th>
                  <th className="p-2 font-medium">Grupo</th>
                  <th className="p-2 font-medium text-right">Uso</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {cats.isLoading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhuma categoria</td></tr>
                ) : filtered.map((c) => {
                  const used = counts.data?.get(c.id) ?? 0;
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="p-2 font-medium">{c.nome}</td>
                      <td className="p-2 text-muted-foreground">{c.tipo_predominante ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{c.grupo ?? "—"}</td>
                      <td className="p-2 text-right tabular-nums">
                        {used > 0 ? (
                          <Badge variant="secondary">{used}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="p-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={used > 0}
                          title={used > 0 ? "Categoria em uso — não pode excluir" : "Excluir"}
                          onClick={() => setConfirmDelete(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{confirmDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteMut.mutate(confirmDelete);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
