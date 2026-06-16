import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useItemDrawer } from "@/components/bj7/ItemDrawer";
import { NotasRapidasDrawer } from "@/components/notas/NotasRapidasDrawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, ListTodo, Banknote, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

export function Fab() {
  const navigate = useNavigate();
  const drawer = useItemDrawer();
  const [notasOpen, setNotasOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              className={cn(
                "h-14 w-14 rounded-full shadow-lg",
                "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>Criação rápida</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => drawer.open({ entidade_tipo: "tarefa" })}>
              <ListTodo className="h-4 w-4 mr-2" /> Nova tarefa
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/financeiro/contas-a-pagar" })}>
              <Banknote className="h-4 w-4 mr-2" /> Conta a pagar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/fiscal/obrigacoes" })}>
              <Receipt className="h-4 w-4 mr-2" /> Obrigação fiscal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNotasOpen(true)}>
              <StickyNote className="h-4 w-4 mr-2" /> Nota rápida
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <NotasRapidasDrawer open={notasOpen} onOpenChange={setNotasOpen} />
    </>
  );
}
