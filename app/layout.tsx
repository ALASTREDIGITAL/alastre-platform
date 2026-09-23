import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./typography.css";
import "./tracking-lifecycle.css";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Alastre Digital — Plataforma",
  description: "Sistema operacional interno da Alastre Digital.",
  other: { "codex-preview": "development" },
  icons: { icon: "/alastre-logo.png", shortcut: "/alastre-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
