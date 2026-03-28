"use client";

import Link from "next/link";
import { DashboardHamburgerMenu } from "@/components/dashboard/DashboardHamburgerMenu";

/**
 * Shared top bar: brand, quick links (md+), and the same drawer menu as the map home page.
 */
export function SiteHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
      <Link
        href="/"
        className="text-sm font-bold tracking-tight text-sky-600 dark:text-sky-400"
      >
        Civic Ghana
      </Link>
      <div className="flex items-center gap-2">
        <nav
          className="mr-2 hidden items-center gap-4 text-xs font-medium text-slate-600 md:flex dark:text-slate-400"
          aria-label="Quick links"
        >
          <Link href="/" className="transition hover:text-slate-900 dark:hover:text-white">
            Map
          </Link>
          <Link
            href="/dashboard"
            className="transition hover:text-slate-900 dark:hover:text-white"
          >
            Dashboard
          </Link>
          <Link
            href="/report"
            className="transition hover:text-slate-900 dark:hover:text-white"
          >
            Report
          </Link>
          <Link
            href="/login"
            className="transition hover:text-slate-900 dark:hover:text-white"
          >
            Sign in
          </Link>
        </nav>
        <DashboardHamburgerMenu />
      </div>
    </header>
  );
}
