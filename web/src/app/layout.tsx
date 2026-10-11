import type { Metadata, Viewport } from "next";
import { APP_NAME, APP_TAGLINE, SOURCE_LABEL } from "@/lib/config";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} · ${SOURCE_LABEL}`,
  description: APP_TAGLINE,
};

export const viewport: Viewport = { themeColor: "#0F1F4B", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
