import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (Auth + Realtime + DB from Client Components).
 *
 * Foundation stub: the client is wired and reads from env, but no auth flows are
 * implemented yet. See the product routes under `app/(app)/` for where this
 * plugs in. Requires NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
