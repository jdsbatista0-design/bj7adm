import { supabase } from "@/integrations/supabase/client";

export async function _typecheck() {
  const r = await supabase.from("usuarios").select("*").eq("auth_uid", "x").maybeSingle();
  return r.data?.id;
}
