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
    const { empresa_id, item_id, connector_id, connector_name } = await req.json() as {
      empresa_id: number;
      item_id: string;
      connector_id?: number;
      connector_name?: string;
    };

    if (!empresa_id || !item_id) {
      throw new Error("empresa_id e item_id são obrigatórios");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Upsert pela chave natural pluggy_item_id (mesma conta pode ser reconectada)
    const { data, error } = await supabase
      .from("openfinance_connections")
      .upsert(
        {
          empresa_id,
          pluggy_item_id: item_id,
          pluggy_connector_id: connector_id ?? null,
          connector_name: connector_name ?? null,
          status: "UPDATED",
          last_sync_at: new Date().toISOString(),
          last_sync_status: "UPDATED",
          last_error: null,
        },
        { onConflict: "pluggy_item_id" },
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ connection: data }), {
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
