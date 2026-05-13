import "dotenv/config";

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  frontendOrigins: splitOrigins(process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500,http://localhost:5500"),
  accountInviteCode: process.env.ACCOUNT_INVITE_CODE || "",
  firstAdminEmail: String(process.env.FIRST_ADMIN_EMAIL || "").trim().toLowerCase()
};

export function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}
