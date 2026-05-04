import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "KSHR Internal",
  description: "Internal CRM and portfolio management for KSHR."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
