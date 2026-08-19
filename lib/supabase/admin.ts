import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS. `documents`/`doctors`/`queries`/`citations` have no
 * anon/authenticated policies (see supabase/migrations/20260818090100_enable_rls.sql), so this
 * is the only write path. Never import this outside trusted server code (scripts, server actions).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for admin/ingestion operations",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
