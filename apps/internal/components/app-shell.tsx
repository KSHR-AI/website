import { redirect } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { PrimaryNav } from "@/components/primary-nav";
import { requireActiveUser } from "@/lib/supabase/server";

export async function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { appUser } = await requireActiveUser();

  if (!appUser) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <header className="workspace-bar">
        <BrandMark />
        <PrimaryNav />
        <div className="workspace-account">
          <span className="account-copy">
            <strong>{appUser.email}</strong>
            <small>{appUser.role}</small>
          </span>
          <form action={signOut}>
            <button className="button tertiary compact" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="main-area">
        <div className="workspace-canvas">{children}</div>
      </main>
    </div>
  );
}
