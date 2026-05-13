import { createClient } from "@supabase/supabase-js";
import { config, requireEnv } from "./config.js";

requireEnv("SUPABASE_URL", config.supabaseUrl);
requireEnv("SUPABASE_PUBLISHABLE_KEY", config.supabasePublishableKey);

export const supabaseAuth = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export const supabaseAdmin = config.supabaseSecretKey
  ? createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;
