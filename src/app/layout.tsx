import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="sticky top-0 z-50 border-b-2 border-neutral-800 bg-black text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-xl font-black uppercase tracking-widest">
              FIX MY BRAIN
            </Link>
            <div className="flex items-center gap-8 text-sm font-bold uppercase tracking-wider">
              <Link href="/" className="transition-opacity hover:opacity-60">
                Start Here
              </Link>
              <Link href="/my-condition" className="transition-opacity hover:opacity-60">
                My Condition
              </Link>
              <Link href="/about" className="transition-opacity hover:opacity-60">
                About Me
              </Link>
              <Link href="/livestream" className="flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-80">
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-white opacity-60" />
                  <span className="absolute inline-flex h-full w-full animate-ping-slow-delayed rounded-full bg-white opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                Watch Livestream
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
