import { createContext, useContext, useState, type ReactNode } from "react";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/contexts/auth-context";
import { useEmpresas, useUsuarios } from "@/hooks/use-refs";
import type { TarefaRow, TarefaStatus, Prioridade } from "@/integrations/supabase/database";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

type EntidadeTipo =
  | "tarefa"
  | "lead"
  | "oportunidade"
  | "proposta"
  | "followup"
  | "cobranca"
  | "contrato"
  | "reuniao"
  | "decisao"
  | "ideia"
  | "documento"
  | "problema";

const TIPOS: { value: EntidadeTipo; label: string }[] = [
  { value: "tarefa", label: "Tarefa" },
  { value: "lead", label: "Lead" },
  { value: "oportunidade", label: "Oportunidade" },
  { value: "proposta", label: "Proposta" },
  { value: "followup", label: "Follow-up" },
  { value: "cobranca", label: "Cobrança" },
  { value: "contrato", label: "Contrato" },
  { value: "reuniao", label: "Reunião" },
  { value: "decisao", label: "Decisão" },
  { value: "ideia", label: "Ideia" },
  { value: "documento", label: "Documento" },
  { value: "problema", label: "Problema" },
];

const STATUS_OPTS: { value: TarefaStatus; label: string }[] = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando", label: "Aguardando" },
  { value: "concluida", label: "Concluída" },
  { value: "cancelada", label: "Cancelada" },
];

type OpenArgs = {
  entidade_tipo?: EntidadeTipo;
  empresa_id?: number | null;
  tarefa?: TarefaRow;
};

interface ItemDrawerContext {
  open: (defaults?: OpenArgs) => void;
}

const Ctx = createContext<ItemDrawerContext | null>(null);

export function useItemDrawer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useItemDrawer fora do provider");
  return ctx;
}

export function ItemDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaults, setDefaults] = useState<OpenArgs>({});

  return (
    <Ctx.Provider
      value={{
        open: (d) => {
          setDefaults(d ?? {});
          setIsOpen(true);
        },
      }}
    >
      {children}
      <ItemDrawer open={isOpen} onOpenChange={setIsOpen} defaults={defaults} />
    </Ctx.Provider>
  );
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["itens", "tarefas"] });
  qc.invalidateQueries({ queryKey: ["tarefas"] });
  qc.invalidateQueries({ queryKey: ["central"] });
  qc.invalidateQueries({ queryKey: ["hoje"] });
}

function ItemDrawer({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaults: OpenArgs;
}) {
  const user = useCurrentUser();
  const empresas = useEmpresas();
  const usuarios = useUsuarios();
  const qc = useQueryClient();

  const editing = defaults.tarefa ?? null;
  const isEdit = !!editing;

  const [tipo, setTipo] = useState<EntidadeTipo>("tarefa");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [status, setStatus] = useState<TarefaStatus>("aberta");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [prazo, setPrazo] = useState<string>("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTipo((editing.entidade_tipo as EntidadeTipo) ?? "tarefa");
      setTitulo(editing.titulo);
      setDescricao(editing.descricao ?? "");
      setPrioridade(editing.prioridade);
      setStatus(editing.status);
      setEmpresaId(editing.empresa_id ? String(editing.empresa_id) : "0");
      setResponsavelId(editing.responsavel_id ? String(editing.responsavel_id) : "0");
      setPrazo(toDateInput(editing.prazo));
    } else {
      setTipo(defaults.entidade_tipo ?? "tarefa");
      setTitulo("");
      setDescricao("");
      setPrioridade("media");
      setStatus("aberta");
      setEmpresaId(defaults.empresa_id ? String(defaults.empresa_id) : "0");
      setResponsavelId(user.id ? String(user.id) : "0");
      setPrazo("");
    }
  }, [open, defaults, editing, user.id]);

  const save = useMutation({
    mutationFn: async () => {
      const base = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prioridade,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        entidade_tipo: tipo,
        empresa_id: empresaId && empresaId !== "0" ? Number(empresaId) : null,
        responsavel_id:
          responsavelId && responsavelId !== "0" ? Number(responsavelId) : null,
      };

      if (isEdit && editing) {
        // status change: use RPC for "concluida" so concluida_em is set consistently
        if (status === "concluida" && editing.status !== "concluida") {
          const r1 = await supabase.from("tarefas").update(base).eq("id", editing.id);
          if (r1.error) throw r1.error;
          const r2 = await supabase.rpc("concluir_tarefa", { _id: editing.id });
          if (r2.error) throw r2.error;
          return;
        }
        const payload = {
          ...base,
          status,
          concluida_em: status === "concluida" ? editing.concluida_em : null,
        };
        const r = await supabase.from("tarefas").update(payload).eq("id", editing.id);
        if (r.error) throw r.error;
      } else {
        const payload = {
          ...base,
          status,
          origem: "manual" as const,
          criado_por: user.id,
        };
        const { error } = await supabase.from("tarefas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Item atualizado" : "Item criado");
      invalidateAll(qc);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Falha: " + e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const r = await supabase.from("tarefas").delete().eq("id", editing.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      toast.success("Item excluído");
      invalidateAll(qc);
      setConfirmDel(false);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Falha ao excluir: " + e.message),
  });

  const canSubmit = titulo.trim().length > 0 && !save.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar Item" : "Novo Item"}</SheetTitle>
          <SheetDescription>
            Tudo no BJ7 Central é um Item: tarefa, lead, cobrança, decisão. Tem prazo, dono
            e empresa.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as EntidadeTipo)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={(v) => setPrioridade(v as Prioridade)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="O que precisa ser feito?"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto, próximo passo, detalhes…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TarefaStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sem empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">— Sem empresa —</SelectItem>
                  {(empresas.data ?? []).map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">— Sem responsável —</SelectItem>
                  {(usuarios.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDel(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={!canSubmit} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar Item"}
            </Button>
          </div>
        </SheetFooter>

        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este item?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O item será removido permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  del.mutate();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
