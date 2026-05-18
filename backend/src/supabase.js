import { createClient } from "@supabase/supabase-js";
import { config, requireEnv } from "./config.js";

requireEnv("SUPABASE_URL", config.supabaseUrl);
requireEnv("SUPABASE_PUBLISHABLE_KEY", config.supabasePublishableKey);

/**
 * Supabase client used to validate user sessions from browser requests.
 *
 * Session persistence is disabled because the Express API manages cookies and
 * verifies each request explicitly.
 */
export const supabaseAuth = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/**
 * Optional service-role client for administrative account setup.
 *
 * Keep privileged operations isolated here; normal record routes should rely on
 * authenticated user context and Prisma campus scoping.
 */
export const supabaseAdmin = config.supabaseSecretKey
  ? createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;
