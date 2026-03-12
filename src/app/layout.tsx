import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FIX MY BRAIN",
  description: "Live coverage of one person's journey to understand their own mind",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex h-dvh flex-col overflow-hidden antialiased`}
      >
        <nav className="relative z-50 shrink-0 border-b-2 border-neutral-800 bg-black text-white">
          <div className="flex items-center justify-between px-6 py-3">
            <Link href="/" className="text-xl font-black uppercase tracking-widest">
              FIX MY BRAIN
            </Link>
            <MobileNav />
          </div>
        </nav>
        <div className="min-h-0 flex-1">{children}</div>
      </body>
    </html>
  );
}
