import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import "./globals.css";

const display = localFont({
  src: "./fonts/bricolage.woff2",
  variable: "--nf-display",
  weight: "200 800",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/martian.woff2",
  variable: "--nf-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} · IRAS 16293-2422`,
  description: APP_TAGLINE,
};

export const viewport: Viewport = { themeColor: "#0F1126", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
