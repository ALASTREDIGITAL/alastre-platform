import type { Metadata } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";
import "./typography.css";
import "./tracking-lifecycle.css";
import { ThemeProvider } from "./theme-provider";

export const metadata: Metadata = {
  title: "Alastre Digital — Plataforma",
  description: "Sistema operacional interno da Alastre Digital.",
  other: { "codex-preview": "development" },
  icons: { icon: "/alastre-logo.png", shortcut: "/alastre-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
