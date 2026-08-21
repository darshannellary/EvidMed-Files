import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Required by @supabase/ssr's own design docs: "Using the middleware pattern is mandatory.
 * Session refresh happens in the middleware... Not using a middleware function means the session
 * will likely not be properly refreshed." (node_modules/@supabase/ssr/docs/design.md)
 *
 * Refresh-only — no redirect/route-protection logic here. That branching lives in
 * lib/auth/session.ts so the "is this doctor allowed here" logic exists in one reviewable place.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() (not getSession()) round-trips to Supabase Auth to validate the JWT — the
  // documented-correct check server-side, and what actually triggers the refresh.
  await supabase.auth.getUser();

  return response;
}
