import { useState } from "react";
import type { ContaAPagarRow } from "@/integrations/supabase/database";
import { useEmpresas, useCategorias } from "@/hooks/use-refs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

export function MarcarPagoPopover({
  conta,
  onConfirm,
  trigger,
}: {
  conta: ContaAPagarRow;
  onConfirm: (input: { dataPagamento: string; valorPago: number; empresaId: number; categoriaId: number | null }) => Promise<void> | void;
  trigger: React.ReactNode;
}) {
  const empresas = useEmpresas();
  const categorias = useCategorias();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);
  const [valor, setValor] = useState(String(conta.valor).replace(".", ","));
  const [empresaId, setEmpresaId] = useState(conta.empresa_id ? String(conta.empresa_id) : "0");
  const [categoriaId, setCategoriaId] = useState(conta.categoria_id ? String(conta.categoria_id) : "0");
  const [saving, setSaving] = useState(false);

  const valorNum = Number((valor || "").replace(/\./g, "").replace(",", ".")) || 0;
  const valido = !!data && valorNum > 0 && empresaId !== "0";

  async function confirmar() {
    if (!valido) return;
    setSaving(true);
    try {
      await onConfirm({
        dataPagamento: data,
        valorPago: valorNum,
        empresaId: Number(empresaId),
        categoriaId: categoriaId !== "0" ? Number(categoriaId) : null,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="text-sm font-medium">Confirmar pagamento</div>
        <div className="text-[11px] text-muted-foreground -mt-2 truncate">{conta.descricao}</div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Valor pago</Label>
            <Input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
        </div>

        <div>
          <Label className="text-xs">Empresa *</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">—</SelectItem>
              {empresas.data?.map(e => (
                <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Categoria</Label>
          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent className="max-h-[200px]">
              <SelectItem value="0">—</SelectItem>
              {categorias.data?.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Será criado um Lançamento (Despesa) vinculado ao DRE.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={confirmar} disabled={!valido || saving}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            {saving ? "..." : "Confirmar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
