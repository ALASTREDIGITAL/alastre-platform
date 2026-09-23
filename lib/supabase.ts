import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createSupabaseBrowserClient(): SupabaseClient<Database> | null {
  try {
    const url =
      (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_URL : undefined) ??
      (typeof window !== "undefined" && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.NEXT_PUBLIC_SUPABASE_URL) ??
      (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, string> }).env?.NEXT_PUBLIC_SUPABASE_URL);

    const publishableKey =
      (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined) ??
      (typeof window !== "undefined" && (window as unknown as { __ENV__?: Record<string, string> }).__ENV__?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
      (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, string> }).env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    if (!url || !publishableKey) {
      return null;
    }

    return createClient<Database>(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return null;
  }
}
