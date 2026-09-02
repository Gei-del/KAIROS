import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let singleton: SupabaseClient | null = null;

// These are publishable browser credentials, not privileged secrets. Keeping a
// fallback prevents production from becoming unusable when a hosting environment
// is redeployed without its public variables. Environment values still win.
const DEFAULT_SUPABASE_URL = "https://zbmxmmofwforameoffem.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_sNJiWa3bJYw187SI_Y6Yyw_0Nh0mdkj";

function validHttpUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export function getSupabase(): SupabaseClient {
  const url =
    validHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? DEFAULT_SUPABASE_URL;
  const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const key = configuredKey?.startsWith("sb_publishable_")
    ? configuredKey
    : DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  singleton ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return singleton;
}

export async function ensureAnonymousSession() {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const result = await supabase.auth.signInAnonymously();
  if (result.error) throw result.error;
  return result.data.session;
}
