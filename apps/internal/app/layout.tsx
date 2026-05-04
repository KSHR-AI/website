import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "KSHR Internal",
  description: "Internal CRM and portfolio management for KSHR.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
