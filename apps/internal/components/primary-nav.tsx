"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/companies", label: "Companies" },
  { href: "/contacts", label: "Contacts" },
  { href: "/tasks", label: "Tasks" },
  { href: "/agent", label: "Signals" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="nav-list" aria-label="Internal tools">
      {navItems.map((item) => (
        <Link
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className="nav-link"
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
