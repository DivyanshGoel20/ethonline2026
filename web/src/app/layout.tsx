import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Float — a credit line for agents that spend",
  description:
    "Float opens a USDC credit line against a verified human, so their agents can keep paying when a bill lands before the balance does. Settled on Arc, gated by World, indexed by The Graph.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Familjen+Grotesk:wght@400;500;600&family=Martian+Mono:wght@300;400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
