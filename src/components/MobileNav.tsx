"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button - mobile only */}
      <button
        onClick={() => setOpen(!open)}
        className="flex flex-col justify-center gap-1.5 md:hidden"
        aria-label="Toggle menu"
      >
        <span
          className={`h-0.5 w-6 bg-white transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
        />
        <span
          className={`h-0.5 w-6 bg-white transition-opacity ${open ? "opacity-0" : ""}`}
        />
        <span
          className={`h-0.5 w-6 bg-white transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
        />
      </button>

      {/* Desktop nav - always visible */}
      <div className="hidden items-center gap-8 text-sm font-bold uppercase tracking-wider md:flex">
        <Link href="/" className="transition-opacity hover:opacity-60">
          Start Here
        </Link>
        <Link href="/my-condition" className="transition-opacity hover:opacity-60">
          My Condition
        </Link>
        <Link href="/about" className="transition-opacity hover:opacity-60">
          About Me
        </Link>
        <Link
          href="/livestream"
          className="flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-80"
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-white opacity-60" />
            <span className="absolute inline-flex h-full w-full animate-ping-slow-delayed rounded-full bg-white opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          Watch Livestream
        </Link>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute left-0 top-full w-full border-b-2 border-neutral-800 bg-black md:hidden">
          <div className="flex flex-col gap-4 px-6 py-4 text-sm font-bold uppercase tracking-wider">
            <Link href="/" onClick={() => setOpen(false)} className="transition-opacity hover:opacity-60">
              Start Here
            </Link>
            <Link href="/my-condition" onClick={() => setOpen(false)} className="transition-opacity hover:opacity-60">
              My Condition
            </Link>
            <Link href="/about" onClick={() => setOpen(false)} className="transition-opacity hover:opacity-60">
              About Me
            </Link>
            <Link
              href="/livestream"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded bg-red-600 px-2.5 py-1 w-fit text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-80"
            >
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-white opacity-60" />
                <span className="absolute inline-flex h-full w-full animate-ping-slow-delayed rounded-full bg-white opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              Watch Livestream
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
