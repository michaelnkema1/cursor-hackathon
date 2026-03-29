"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";

const NAV = [
  { href: "/dashboard", label: "Investigation workspace" },
  { href: "/report", label: "Log a problem" },
  { href: "/signup", label: "Create another account" },
] as const;

type DashboardHamburgerMenuProps = {
  userEmail?: string | null;
};

export function DashboardHamburgerMenu({
  userEmail = null,
}: DashboardHamburgerMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-[0.98] dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100 dark:hover:bg-slate-900"
        aria-expanded={open}
        aria-controls="dashboard-nav-drawer"
        aria-label="Open menu"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-1000 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-nav-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <nav
            id="dashboard-nav-drawer"
            className="relative flex h-full w-[min(100%,22rem)] flex-col border-l border-white/60 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95"
          >
            <div className="border-b border-slate-200/80 px-4 py-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span
                  id="dashboard-nav-title"
                  className="text-sm font-semibold text-slate-900 dark:text-white"
                >
                  Workspace navigation
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  aria-label="Close menu"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
                  Active user
                </p>
                <p className="mt-2 break-all text-sm font-medium text-slate-900 dark:text-slate-100">
                  {userEmail ?? "Signed in"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Cases you submit from this session flow through the protected backend route.
                </p>
              </div>
            </div>
            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-3.5 text-base font-semibold text-slate-800 transition hover:bg-slate-100 active:bg-slate-200 dark:text-slate-100 dark:hover:bg-slate-900 dark:active:bg-slate-800"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
              <SignOutButton className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400" />
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
