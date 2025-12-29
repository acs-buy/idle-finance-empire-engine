import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { loadServerConfig } from "@/engine/config/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const config = loadServerConfig();
const serializedConfig = JSON.stringify(config).replace(/</g, "\\u003c");

export const metadata: Metadata = {
  title: config.game.name,
  description: config.game.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-slate-50 antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__GAME_CONFIG__=${serializedConfig};`,
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
