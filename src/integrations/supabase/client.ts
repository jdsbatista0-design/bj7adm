import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://fcalhtuolxxeijxnquqj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjYWxodHVvbHh4ZWlqeG5xdXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODUxMjUsImV4cCI6MjA5NDM2MTEyNX0.LAWEvBjVnbH_cBtmNM6jk91p6X2LMHATM_XBtaaoMdk";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
