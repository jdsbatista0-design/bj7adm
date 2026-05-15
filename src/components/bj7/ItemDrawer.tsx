import { createContext, useContext, useState, type ReactNode } from "react";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/contexts/auth-context";
import { useEmpresas } from "@/hooks/use-refs";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

type Prioridade = "baixa" | "media" | "alta" | "urgente";

interface ItemDrawerContext {
  open: (defaults?: { entidade_tipo?: EntidadeTipo; empresa_id?: number | null }) => void;
}

const Ctx = createContext<ItemDrawerContext | null>(null);

export function useItemDrawer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useItemDrawer fora do provider");
  return ctx;
}

export function ItemDrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaults, setDefaults] = useState<{
    entidade_tipo?: EntidadeTipo;
    empresa_id?: number | null;
  }>({});

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
      <ItemDrawer
        open={isOpen}
        onOpenChange={setIsOpen}
        defaults={defaults}
      />
    </Ctx.Provider>
  );
}

function ItemDrawer({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaults: { entidade_tipo?: EntidadeTipo; empresa_id?: number | null };
}) {
  const user = useCurrentUser();
  const empresas = useEmpresas();
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<EntidadeTipo>("tarefa");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [prazo, setPrazo] = useState<string>("");

  // reset quando abre
  useEffect(() => {
    if (open) {
      setTipo(defaults.entidade_tipo ?? "tarefa");
      setTitulo("");
      setDescricao("");
      setPrioridade("media");
      setEmpresaId(defaults.empresa_id ? String(defaults.empresa_id) : "");
      setPrazo("");
    }
  }, [open, defaults]);

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prioridade,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        status: "aberta" as const,
        entidade_tipo: tipo,
        empresa_id: empresaId ? Number(empresaId) : null,
        origem: "manual" as const,
        responsavel_id: user.id,
        criado_por: user.id,
      };
      const { error } = await supabase.from("tarefas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item criado");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["central"] });
      qc.invalidateQueries({ queryKey: ["hoje"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Falha: " + e.message),
  });

  const canSubmit = titulo.trim().length > 0 && !create.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Novo Item</SheetTitle>
          <SheetDescription>
            Tudo no BJ7 Central é um Item: tarefa, lead, cobrança, decisão. Tem prazo, dono e
            empresa.
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
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as Prioridade)}>
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
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Item
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
