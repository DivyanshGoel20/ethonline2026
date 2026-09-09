import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Float — Controlled USDC Credit Lines for AI Agents",
  description:
    "Float provides AI agents with controlled USDC credit lines on Arc, verified via World Selfie Check, and indexed by The Graph.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#090d16] text-slate-100 selection:bg-teal-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
