import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oasis",
  description: "Tahová fantasy výprava do pouště kolem magické oázy.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
