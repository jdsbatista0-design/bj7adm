const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { empresa_id: _empresa_id, item_id } = await req.json();

    const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Credenciais Pluggy não configuradas (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET)");
    }

    // 1. Troca clientId+clientSecret por API key temporária
    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    if (!authRes.ok) {
      const msg = await authRes.text();
      throw new Error(`Pluggy auth: ${authRes.status} — ${msg}`);
    }
    const { apiKey } = await authRes.json() as { apiKey: string };

    // 2. Cria connect_token para o widget (itemId opcional = reconexão)
    const tokenBody: Record<string, unknown> = {};
    if (item_id) tokenBody.itemId = item_id;

    const tokenRes = await fetch("https://api.pluggy.ai/connect_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(tokenBody),
    });
    if (!tokenRes.ok) {
      const msg = await tokenRes.text();
      throw new Error(`Pluggy connect_token: ${tokenRes.status} — ${msg}`);
    }
    const { accessToken } = await tokenRes.json() as { accessToken: string };

    return new Response(JSON.stringify({ accessToken }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
