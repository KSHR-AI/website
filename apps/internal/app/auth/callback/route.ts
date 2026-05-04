import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { ensureAppUser, createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code && (!tokenHash || !type)) {
    return new Response(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>KSHR Internal</title>
  </head>
  <body>
    <script>
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        window.location.replace("/login?error=signin_failed");
      } else {
        fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            next: ${JSON.stringify(next)}
          })
        })
          .then((response) => response.json())
          .then((result) => window.location.replace(result.redirectTo || "/"))
          .catch(() => window.location.replace("/login?error=signin_failed"));
      }
    </script>
  </body>
</html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8"
        }
      }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type!
      });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=signin_failed", request.url));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=signin_failed", request.url));
  }

  const appUser = await ensureAppUser({ id: user.id, email: user.email });

  if (!appUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_allowed", request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
