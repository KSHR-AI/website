import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { BrandMark } from "@/components/brand-mark";
import { requireActiveUser } from "@/lib/supabase/server";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/agent", label: "Agent" },
  { href: "/companies", label: "Companies" },
  { href: "/contacts", label: "Contacts" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/tasks", label: "Tasks" }
];

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { appUser } = await requireActiveUser();

  if (!appUser) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <BrandMark />
        <nav className="nav-list" aria-label="Internal tools">
          {navItems.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="button secondary" type="submit">
            Sign out
          </button>
        </form>
        <p className="sidebar-footer">
          Signed in as {appUser.email}
          <br />
          Role: {appUser.role}
        </p>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}
