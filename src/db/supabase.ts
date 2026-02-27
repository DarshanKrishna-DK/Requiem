import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env");
}

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
