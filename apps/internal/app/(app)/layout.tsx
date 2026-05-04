import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default function InternalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
