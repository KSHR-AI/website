"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAllowedEmails, isEnvConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInWithEmail(formData: FormData) {
  if (!isEnvConfigured()) {
    redirect("/login?error=missing_env");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const allowedEmails = getAllowedEmails();

  if (!email || (allowedEmails.size > 0 && !allowedEmails.has(email))) {
    redirect("/login?error=not_allowed");
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`
    }
  });

  if (error) {
    redirect("/login?error=signin_failed");
  }

  redirect("/login?sent=1");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
