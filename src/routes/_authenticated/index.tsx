import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useCurrentUser } from "@/contexts/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type {
  AlertaRow,
  TarefaRow,
  Severidade,
} from "@/integrations/supabase/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Sparkles,
  Pause,
  Play,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: Cockpit,
});

type TabKey = "hoje" | "aguardando" | "travado" | "oportunidades" | "followup";

function severityColor(s: Severidade) {
  if (s === "critical") return "bg-destructive text-destructive-foreground";
  if (s === "warn") return "bg-amber-500 text-white";
  return "bg-muted text-foreground";
}

function severityDot(s: Severidade) {
  if (s === "critical") return "bg-destructive";
  if (s === "warn") return "bg-amber-500";
  return "bg-muted-foreground";
}

function Cockpit() {
  const user = useCurrentUser();
  const [alertas, setAlertas] = useState<AlertaRow[]>([]);
  const [tarefas, setTarefas] = useState<TarefaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<TabKey>("hoje");

  const load = useCallback(async () => {
    setLoading(true);
    const [a, t] = await Promise.all([
      supabase
        .from("alertas")
        .select("*")
        .in("status", ["aberto", "ack", "snoozed"])
        .order("severidade", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(200),
      supabase
        .from("tarefas")
        .select("*")
        .in("status", ["aberta", "em_andamento", "aguardando"])
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(200),
    ]);
    setAlertas((a.data ?? []) as AlertaRow[]);
    setTarefas((t.data ?? []) as TarefaRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const executarMotor = async () => {
    setRunning(true);
    const { error } = await supabase.rpc("executar_regras");
    setRunning(false);
    if (error) {
      toast.error("Falha ao rodar motor: " + error.message);
      return;
    }
    toast.success("Motor de regras executado.");
    await load();
  };

  const counts = useMemo(() => {
    const criticos = alertas.filter((a) => a.severidade === "critical" && a.status === "aberto").length;
    const warns = alertas.filter((a) => a.severidade === "warn" && a.status === "aberto").length;
    const hojeAlertas = alertas.filter((a) => a.status === "aberto");
    const aguardando = alertas.filter((a) => a.status === "ack" || a.status === "snoozed");
    const tarefasAtrasadas = tarefas.filter(
      (t) => t.prazo && new Date(t.prazo) < new Date(),
    );
    const followup = tarefas.filter((t) => t.responsavel_id === user.id);
    return { criticos, warns, hojeAlertas, aguardando, tarefasAtrasadas, followup };
  }, [alertas, tarefas, user.id]);

  const ackAlerta = async (id: number) => {
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, status: "ack" } : a)));
    const { error } = await supabase.rpc("ack_alerta", { _id: id });
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  const resolverAlerta = async (id: number) => {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
    const { error } = await supabase.rpc("resolver_alerta", { _id: id });
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  const snoozeAlerta = async (id: number, horas: number) => {
    setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, status: "snoozed" } : a)));
    const { error } = await supabase.rpc("snooze_alerta", { _id: id, _horas: horas });
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  const concluirTarefa = async (id: number) => {
    setTarefas((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.rpc("concluir_tarefa", { _id: id });
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-3 sm:p-6 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Olá, {user.nome ?? user.email?.split("@")[0]}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={() => void executarMotor()} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Rodar motor
          </Button>
        </div>
      </header>

      {/* Resumo numérico */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <SummaryCard label="Críticos" value={counts.criticos} color="bg-destructive/10 text-destructive" icon={<AlertTriangle className="h-4 w-4" />} />
        <SummaryCard label="Atenção" value={counts.warns} color="bg-amber-500/10 text-amber-700 dark:text-amber-400" icon={<AlertTriangle className="h-4 w-4" />} />
        <SummaryCard label="Tarefas atrasadas" value={counts.tarefasAtrasadas.length} color="bg-orange-500/10 text-orange-600" icon={<Clock className="h-4 w-4" />} />
        <SummaryCard label="Minhas tarefas" value={counts.followup.length} color="bg-primary/10 text-primary" icon={<Inbox className="h-4 w-4" />} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="hoje" className="text-xs sm:text-sm">Hoje</TabsTrigger>
          <TabsTrigger value="aguardando" className="text-xs sm:text-sm">Aguardando</TabsTrigger>
          <TabsTrigger value="travado" className="text-xs sm:text-sm">Travado</TabsTrigger>
          <TabsTrigger value="oportunidades" className="text-xs sm:text-sm">Oport.</TabsTrigger>
          <TabsTrigger value="followup" className="text-xs sm:text-sm">Follow-up</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="space-y-3 mt-4">
          <SectionTitle title="Precisa da sua atenção agora" subtitle={`${counts.hojeAlertas.length} alertas abertos`} />
          {counts.hojeAlertas.length === 0 && !loading && <EmptyState text="Tudo tranquilo. Nenhum alerta aberto." />}
          {counts.hojeAlertas.map((a) => (
            <AlertaCard
              key={a.id}
              a={a}
              onAck={() => ackAlerta(a.id)}
              onResolver={() => resolverAlerta(a.id)}
              onSnooze={() => snoozeAlerta(a.id, 24)}
            />
          ))}

          <SectionTitle title="Tarefas vencendo / atrasadas" subtitle={`${counts.tarefasAtrasadas.length}`} />
          {counts.tarefasAtrasadas.length === 0 && !loading && <EmptyState text="Sem tarefas em atraso." />}
          {counts.tarefasAtrasadas.map((t) => (
            <TarefaCard key={t.id} t={t} onConcluir={() => concluirTarefa(t.id)} />
          ))}
        </TabsContent>

        <TabsContent value="aguardando" className="space-y-3 mt-4">
          <SectionTitle title="Reconhecidos / em snooze" subtitle={`${counts.aguardando.length}`} />
          {counts.aguardando.length === 0 && !loading && <EmptyState text="Nada aguardando." />}
          {counts.aguardando.map((a) => (
            <AlertaCard
              key={a.id}
              a={a}
              onAck={() => ackAlerta(a.id)}
              onResolver={() => resolverAlerta(a.id)}
              onSnooze={() => snoozeAlerta(a.id, 24)}
            />
          ))}
        </TabsContent>

        <TabsContent value="travado" className="space-y-3 mt-4">
          <SectionTitle title="Possíveis gargalos" subtitle="Tarefas em 'aguardando' há tempo" />
          {tarefas.filter((t) => t.status === "aguardando").length === 0 && (
            <EmptyState text="Sem tarefas travadas." />
          )}
          {tarefas
            .filter((t) => t.status === "aguardando")
            .map((t) => (
              <TarefaCard key={t.id} t={t} onConcluir={() => concluirTarefa(t.id)} />
            ))}
        </TabsContent>

        <TabsContent value="oportunidades" className="space-y-3 mt-4">
          <SectionTitle title="Oportunidades detectadas" subtitle="Em construção" />
          <EmptyState text="Detector de oportunidades chega na próxima fase (cross-empresa)." />
        </TabsContent>

        <TabsContent value="followup" className="space-y-3 mt-4">
          <SectionTitle title="Suas tarefas" subtitle={`${counts.followup.length}`} />
          {counts.followup.length === 0 && !loading && <EmptyState text="Sem tarefas atribuídas a você." />}
          {counts.followup.map((t) => (
            <TarefaCard key={t.id} t={t} onConcluir={() => concluirTarefa(t.id)} />
          ))}
        </TabsContent>
      </Tabs>

      <footer className="text-xs text-muted-foreground pt-2">
        <Link to="/razao" className="underline">Ir para o Razão</Link>
      </footer>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${color}`}>
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between pt-2">
      <h2 className="text-sm font-medium">{title}</h2>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function AlertaCard({
  a,
  onAck,
  onResolver,
  onSnooze,
}: {
  a: AlertaRow;
  onAck: () => void;
  onResolver: () => void;
  onSnooze: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${severityDot(a.severidade)}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium leading-tight">{a.titulo}</h3>
              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${severityColor(a.severidade)}`}>
                {a.severidade}
              </Badge>
              {a.status !== "aberto" && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {a.status}
                </Badge>
              )}
            </div>
            {a.descricao && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{a.descricao}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          {a.status === "aberto" && (
            <Button size="sm" variant="ghost" onClick={onAck}>
              <Play className="h-3.5 w-3.5 mr-1" /> Ver
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onSnooze}>
            <Pause className="h-3.5 w-3.5 mr-1" /> 24h
          </Button>
          <Button size="sm" variant="default" onClick={onResolver}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TarefaCard({ t, onConcluir }: { t: TarefaRow; onConcluir: () => void }) {
  const overdue = t.prazo && new Date(t.prazo) < new Date();
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-medium leading-tight">{t.titulo}</h3>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.prioridade}</Badge>
              {overdue && <Badge className="text-[10px] px-1.5 py-0 bg-destructive">atrasada</Badge>}
            </div>
            {t.descricao && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.descricao}</p>
            )}
            {t.prazo && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Prazo: {new Date(t.prazo).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={onConcluir}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
