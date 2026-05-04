import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAllowedEmails, getPublicSupabaseEnv, getServiceRoleKey } from "@/lib/env";

export type AppUser = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: "active" | "inactive";
};

export async function createSupabaseServerClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always set cookies. Middleware refreshes sessions.
        }
      }
    }
  });
}

export function createServiceRoleClient() {
  const { url } = getPublicSupabaseEnv();
  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function ensureAppUser(user: { id: string; email?: string | null }) {
  const email = user.email?.toLowerCase();
  const allowedEmails = getAllowedEmails();

  if (!email || (allowedEmails.size > 0 && !allowedEmails.has(email))) {
    return null;
  }

  const serviceClient = createServiceRoleClient();
  if (!serviceClient) {
    return null;
  }

  const { data: existingUser } = await serviceClient
    .from("app_users")
    .select("id,email,role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (existingUser) {
    return existingUser as AppUser;
  }

  const { data, error } = await serviceClient
    .from("app_users")
    .insert({
      id: user.id,
      email,
      role: "admin",
      status: "active"
    })
    .select("id,email,role,status")
    .single();

  if (error) {
    return null;
  }

  return data as AppUser;
}

export async function requireActiveUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowedEmails = getAllowedEmails();
  const email = user.email?.toLowerCase();

  if (!email || (allowedEmails.size > 0 && !allowedEmails.has(email))) {
    redirect("/login?error=not_allowed");
  }

  const { data: existingUser } = await supabase
    .from("app_users")
    .select("id,email,role,status")
    .eq("id", user.id)
    .maybeSingle();

  const appUser = existingUser ?? (await ensureAppUser({ id: user.id, email }));

  if (!appUser || appUser.status !== "active") {
    redirect("/login?error=inactive");
  }

  return {
    supabase,
    user,
    appUser: appUser as AppUser
  };
}
