import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { item_id, connection_id } = await req.json() as {
      item_id: string;
      connection_id: number;
    };

    if (!item_id || !connection_id) {
      throw new Error("item_id e connection_id são obrigatórios");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      throw new Error("Credenciais Pluggy não configuradas");
    }

    // 1. Autenticar na API Pluggy
    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    if (!authRes.ok) throw new Error(`Pluggy auth: ${authRes.status}`);
    const { apiKey } = await authRes.json() as { apiKey: string };

    // 2. Marcar como UPDATING enquanto processa
    await supabase
      .from("openfinance_connections")
      .update({ status: "UPDATING", last_sync_at: new Date().toISOString() })
      .eq("id", connection_id);

    // 3. Buscar status atual do item no Pluggy
    const itemRes = await fetch(`https://api.pluggy.ai/items/${item_id}`, {
      headers: { "X-API-KEY": apiKey },
    });

    if (!itemRes.ok) {
      const errText = await itemRes.text();
      await supabase
        .from("openfinance_connections")
        .update({ status: "ERROR", last_error: errText, last_sync_status: "ERROR" })
        .eq("id", connection_id);
      throw new Error(`Pluggy item: ${itemRes.status} — ${errText}`);
    }

    const item = await itemRes.json() as {
      status: string;
      lastUpdatedAt?: string;
      error?: { code: string; message: string };
    };

    // 4. Atualizar status no banco
    await supabase
      .from("openfinance_connections")
      .update({
        status: item.status,
        last_sync_at: item.lastUpdatedAt ?? new Date().toISOString(),
        last_sync_status: item.status,
        last_error: item.error?.message ?? null,
      })
      .eq("id", connection_id);

    return new Response(JSON.stringify({ status: item.status }), {
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
