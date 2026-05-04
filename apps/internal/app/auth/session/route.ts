import { NextResponse } from "next/server";

import { ensureAppUser, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : null;
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : null;
  const next = typeof body?.next === "string" && body.next.startsWith("/") ? body.next : "/";

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ redirectTo: "/login?error=signin_failed" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error) {
    return NextResponse.json({ redirectTo: "/login?error=signin_failed" }, { status: 400 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ redirectTo: "/login?error=signin_failed" }, { status: 400 });
  }

  const appUser = await ensureAppUser({ id: user.id, email: user.email });

  if (!appUser) {
    await supabase.auth.signOut();
    return NextResponse.json({ redirectTo: "/login?error=not_allowed" }, { status: 403 });
  }

  return NextResponse.json({ redirectTo: next });
}
