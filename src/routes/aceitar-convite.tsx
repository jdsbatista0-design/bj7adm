import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { aceitarConvite } from "@/lib/convites.functions";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/aceitar-convite")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: AceitarConvitePage,
});

function AceitarConvitePage() {
  const { token } = Route.useSearch();
  const { refresh } = useAuth();
  const aceitar = useServerFn(aceitarConvite);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<{ email: string; nome: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!token) {
      setErro("Link inválido — falta o token.");
      setLoading(false);
      return;
    }
    void (async () => {
      const r = await supabase.rpc("get_convite_publico", { _token: token });
      if (r.error) {
        setErro("Não foi possível verificar o convite.");
      } else {
        const row = (r.data as Array<{ email: string; nome: string | null; expirado: boolean; usado: boolean }> | null)?.[0];
        if (!row) setErro("Convite não encontrado.");
        else if (row.usado) setErro("Este convite já foi utilizado. Faça login normalmente.");
        else if (row.expirado) setErro("Este convite expirou. Peça um novo ao administrador.");
        else setInfo({ email: row.email, nome: row.nome });
      }
      setLoading(false);
    })();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (password.length < 6) return setErro("Senha precisa ter pelo menos 6 caracteres.");
    if (password !== password2) return setErro("As senhas não coincidem.");
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await aceitar({ data: { token, password } });
      // Faz login automático
      const login = await supabase.auth.signInWithPassword({ email: r.email, password });
      if (login.error) throw login.error;
      await refresh();
      setOk(true);
      setTimeout(() => { window.location.href = "/"; }, 800);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao aceitar convite");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceitar convite</CardTitle>
          <CardDescription>
            {loading ? "Verificando convite..." : info ? `Bem-vindo(a) ${info.nome ?? info.email}!` : "Convite"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && erro && <p className="text-sm text-destructive">{erro}</p>}
          {!loading && info && !ok && (
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input value={info.email} disabled />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pw">Crie sua senha</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pw2">Confirme a senha</Label>
                <Input id="pw2" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required minLength={6} />
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Entrando..." : "Ativar acesso e entrar"}
              </Button>
            </form>
          )}
          {ok && <p className="text-sm text-emerald-600">Conta ativada! Redirecionando...</p>}
        </CardContent>
      </Card>
    </div>
  );
}
