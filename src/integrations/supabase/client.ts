import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fcalhtuolxxeijxnquqj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjYWxodHVvbHh4ZWlqeG5xdXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUxMjUsImV4cCI6MjA5NDM2MTEyNX0.LAWEvBjVnbH_cBtmNM6jk91p6X2LMHATM_XBtaaoMdk";

// Untyped client — we apply our own row types at the call site using `as` casts
// (see helpers in @/integrations/supabase/db.ts). The trade-off: no autocomplete
// on table names from the schema, but no fight with the generic `Database` shape
// that supabase-js v2.105 expects.
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
