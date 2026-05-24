import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/bj7/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEmpresas } from "@/hooks/use-refs";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: CalendarioPage,
});

type Origem = "FISCAL" | "COCKPIT" | "REUNIAO" | "RUA" | "DOCUMENTO" | "ONE_ON_ONE";
type Evento = {
  origem: Origem;
  source_id: string;
  data: string;
  hora: string | null;
  titulo: string;
  contexto_extra: string | null;
  empresa_id: number | null;
  empresa_nome: string | null;
  status: string | null;
  valor: number | null;
  criticidade: "OK" | "URGENTE" | "ATRASADO";
  link_modulo: string;
};

const ORIGEM_META: Record<Origem, { label: string; cls: string; dot: string }> = {
  FISCAL:     { label: "Fiscal",     cls: "bg-purple-600/30 text-purple-50 border-purple-400/70", dot: "bg-purple-400" },
  COCKPIT:    { label: "Cockpit",    cls: "bg-blue-600/30 text-blue-50 border-blue-400/70",       dot: "bg-blue-400" },
  REUNIAO:    { label: "Reunião",    cls: "bg-emerald-600/30 text-emerald-50 border-emerald-400/70", dot: "bg-emerald-400" },
  RUA:        { label: "Rua",        cls: "bg-orange-600/30 text-orange-50 border-orange-400/70", dot: "bg-orange-400" },
  DOCUMENTO:  { label: "Documento",  cls: "bg-amber-500/30 text-amber-50 border-amber-300/70",    dot: "bg-amber-400" },
  ONE_ON_ONE: { label: "1:1",        cls: "bg-pink-600/30 text-pink-50 border-pink-400/70",       dot: "bg-pink-400" },
};

const ALL_ORIGENS: Origem[] = ["FISCAL", "COCKPIT", "REUNIAO", "RUA", "DOCUMENTO", "ONE_ON_ONE"];

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfWeek(d: Date) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; }
function sameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function parseISO(s: string) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }

function CalendarioPage() {
  const navigate = useNavigate();
  const empresas = useEmpresas();
  const [origens, setOrigens] = useState<Set<Origem>>(new Set(ALL_ORIGENS));
  const [empresaId, setEmpresaId] = useState<string>("all");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [tab, setTab] = useState<"lista" | "mes" | "semana">("lista");
  const [refDate, setRefDate] = useState(new Date());

  // Date range based on tab
  const { fromISO, toISOEnd } = useMemo(() => {
    const today = new Date();
    if (tab === "mes") {
      return { fromISO: toISO(addDays(startOfMonth(refDate), -7)), toISOEnd: toISO(addDays(endOfMonth(refDate), 7)) };
    }
    if (tab === "semana") {
      const s = startOfWeek(refDate);
      return { fromISO: toISO(s), toISOEnd: toISO(addDays(s, 6)) };
    }
    return { fromISO: toISO(today), toISOEnd: toISO(addDays(today, 30)) };
  }, [tab, refDate]);

  const evQ = useQuery({
    queryKey: ["calendario", fromISO, toISOEnd, empresaId],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase.from("v_calendario_unificado").select("*").gte("data", fromISO).lte("data", toISOEnd).order("data");
      if (empresaId !== "all") q = q.eq("empresa_id", Number(empresaId));
      const r = await q.limit(2000);
      if (r.error) throw r.error;
      return (r.data ?? []) as Evento[];
    },
  });

  const filtered = useMemo(() => {
    return (evQ.data ?? []).filter((e) => {
      if (!origens.has(e.origem)) return false;
      if (onlyCritical && e.criticidade === "OK") return false;
      return true;
    });
  }, [evQ.data, origens, onlyCritical]);

  // KPIs (from today + next 30 regardless of tab)
  const kpiQ = useQuery({
    queryKey: ["calendario", "kpis"],
    staleTime: 60_000,
    queryFn: async () => {
      const today = toISO(new Date());
      const in30 = toISO(addDays(new Date(), 30));
      const r = await supabase.from("v_calendario_unificado").select("data,criticidade").gte("data", today).lte("data", in30).limit(5000);
      if (r.error) throw r.error;
      return (r.data ?? []) as { data: string; criticidade: string }[];
    },
  });

  const kpis = useMemo(() => {
    const todayISO = toISO(new Date());
    const in7ISO = toISO(addDays(new Date(), 7));
    const all = kpiQ.data ?? [];
    return {
      hoje: all.filter((e) => e.data === todayISO).length,
      semana: all.filter((e) => e.data >= todayISO && e.data <= in7ISO).length,
      atrasados: (evQ.data ?? []).filter((e) => e.criticidade === "ATRASADO").length,
      total30: all.length,
    };
  }, [kpiQ.data, evQ.data]);

  const toggleOrigem = (o: Origem) => {
    setOrigens((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o); else next.add(o);
      return next;
    });
  };

  return (
    <PageShell title="Calendário do Grupo BJ7" description="Tudo que acontece em um só lugar">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Hoje" value={kpis.hoje} />
        <KpiCard label="Esta semana" value={kpis.semana} />
        <KpiCard label="Atrasados" value={kpis.atrasados} tone="danger" />
        <KpiCard label="Próximos 30 dias" value={kpis.total30} />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {ALL_ORIGENS.map((o) => {
              const meta = ORIGEM_META[o];
              const active = origens.has(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleOrigem(o)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
                    active ? meta.cls : "border-border text-muted-foreground opacity-50 hover:opacity-100",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas empresas</SelectItem>
                {(empresas.data ?? []).map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch id="critical" checked={onlyCritical} onCheckedChange={setOnlyCritical} />
              <Label htmlFor="critical" className="text-sm">Apenas atrasados/urgentes</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="lista">Próximos 30 dias</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          {evQ.isLoading ? <Skeleton className="h-64" /> :
            <ListaView eventos={filtered} onClick={(e) => navigate({ to: e.link_modulo as never })} />}
        </TabsContent>

        <TabsContent value="mes">
          <div className="flex items-center justify-between mb-3">
            <Button size="sm" variant="outline" onClick={() => setRefDate(addDays(startOfMonth(refDate), -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium capitalize">
              {refDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </div>
            <Button size="sm" variant="outline" onClick={() => setRefDate(addDays(endOfMonth(refDate), 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {evQ.isLoading ? <Skeleton className="h-96" /> :
            <MesView ref0={refDate} eventos={filtered} onClick={(e) => navigate({ to: e.link_modulo as never })} />}
        </TabsContent>

        <TabsContent value="semana">
          <div className="flex items-center justify-between mb-3">
            <Button size="sm" variant="outline" onClick={() => setRefDate(addDays(refDate, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              Semana de {startOfWeek(refDate).toLocaleDateString("pt-BR")}
            </div>
            <Button size="sm" variant="outline" onClick={() => setRefDate(addDays(refDate, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {evQ.isLoading ? <Skeleton className="h-96" /> :
            <SemanaView ref0={refDate} eventos={filtered} onClick={(e) => navigate({ to: e.link_modulo as never })} />}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={cn("text-2xl font-semibold tabular-nums mt-1", tone === "danger" && value > 0 && "text-destructive")}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function dayLabel(d: Date) {
  const today = new Date(); today.setHours(0,0,0,0);
  const amanha = addDays(today, 1);
  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, amanha)) return "Amanhã";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function ListaView({ eventos, onClick }: { eventos: Evento[]; onClick: (e: Evento) => void }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      if (!m.has(e.data)) m.set(e.data, []);
      m.get(e.data)!.push(e);
    }
    return Array.from(m.entries()).sort(([a],[b]) => a.localeCompare(b));
  }, [eventos]);

  if (grouped.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Nenhum evento no período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([data, evs]) => (
        <div key={data}>
          <h3 className="text-sm font-semibold capitalize mb-2 text-muted-foreground">
            {dayLabel(parseISO(data))}
          </h3>
          <div className="space-y-2">
            {evs.map((e) => (
              <EventoCard key={`${e.origem}-${e.source_id}`} ev={e} onClick={() => onClick(e)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventoCard({ ev, onClick }: { ev: Evento; onClick: () => void }) {
  const meta = ORIGEM_META[ev.origem];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border bg-card p-3 transition hover:bg-accent/50 flex items-start gap-3",
        ev.criticidade === "ATRASADO" && "border-destructive/40",
      )}
    >
      <div className="flex flex-col items-center w-12 shrink-0">
        {ev.hora && <span className="text-xs font-medium tabular-nums">{ev.hora.slice(0,5)}</span>}
        <span className={cn("h-2 w-2 rounded-full mt-1", meta.dot)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>{meta.label}</Badge>
          {ev.criticidade === "ATRASADO" && <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>}
          {ev.criticidade === "URGENTE" && <Badge className="text-[10px] bg-orange-500/15 text-orange-300 border-orange-500/30" variant="outline">Urgente</Badge>}
        </div>
        <div className="text-sm font-medium mt-1">{ev.titulo}</div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
          {ev.contexto_extra && <span>{ev.contexto_extra}</span>}
          {ev.empresa_nome && <span>· {ev.empresa_nome}</span>}
          {ev.status && <span>· {ev.status}</span>}
        </div>
      </div>
    </button>
  );
}

function MesView({ ref0, eventos, onClick }: { ref0: Date; eventos: Evento[]; onClick: (e: Evento) => void }) {
  const start = startOfMonth(ref0);
  const gridStart = startOfWeek(start);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const byDay = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      if (!m.has(e.data)) m.set(e.data, []);
      m.get(e.data)!.push(e);
    }
    return m;
  }, [eventos]);

  const dayHeaders = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-px bg-border min-w-[640px] rounded-lg overflow-hidden">
        {dayHeaders.map((d) => (
          <div key={d} className="bg-card p-2 text-xs font-medium text-center text-muted-foreground">{d}</div>
        ))}
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === ref0.getMonth();
          const isToday = sameDay(d, today);
          const dayEvs = byDay.get(toISO(d)) ?? [];
          return (
            <div key={i} className={cn(
              "bg-card p-1.5 min-h-[90px] text-xs",
              !inMonth && "opacity-40",
              isToday && "ring-2 ring-primary",
            )}>
              <div className={cn("font-medium mb-1", isToday && "text-primary")}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {dayEvs.slice(0, 3).map((e) => (
                  <button
                    key={`${e.origem}-${e.source_id}`}
                    onClick={() => onClick(e)}
                    className={cn("w-full text-left truncate rounded px-1 py-0.5 text-[10px] border", ORIGEM_META[e.origem].cls)}
                  >
                    {e.hora && <span className="mr-1 tabular-nums">{e.hora.slice(0,5)}</span>}
                    {e.titulo}
                  </button>
                ))}
                {dayEvs.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">+{dayEvs.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SemanaView({ ref0, eventos, onClick }: { ref0: Date; eventos: Evento[]; onClick: (e: Evento) => void }) {
  const start = startOfWeek(ref0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  const byDay = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      if (!m.has(e.data)) m.set(e.data, []);
      m.get(e.data)!.push(e);
    }
    return m;
  }, [eventos]);

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[840px]">
        {days.map((d) => {
          const isToday = sameDay(d, today);
          const dayEvs = (byDay.get(toISO(d)) ?? []).sort((a,b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
          return (
            <div key={d.toISOString()} className={cn("rounded-lg border bg-card p-2 min-h-[200px]", isToday && "ring-2 ring-primary")}>
              <div className="text-xs text-muted-foreground capitalize mb-2">
                {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })}
              </div>
              <div className="space-y-1.5">
                {dayEvs.map((e) => (
                  <button
                    key={`${e.origem}-${e.source_id}`}
                    onClick={() => onClick(e)}
                    className={cn("w-full text-left rounded border px-2 py-1.5 text-[11px]", ORIGEM_META[e.origem].cls)}
                  >
                    {e.hora && <div className="font-medium tabular-nums">{e.hora.slice(0,5)}</div>}
                    <div className="truncate">{e.titulo}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
