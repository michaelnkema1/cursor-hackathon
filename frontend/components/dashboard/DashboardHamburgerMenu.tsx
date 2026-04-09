"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export function DashboardHamburgerMenu() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const NAV_TOP = [
    { href: "/", label: "Map home", icon: "🗺️" },
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/report", label: "Report an issue", icon: "📍" },
  ];

  const NAV_AUTH = user
    ? [] // signed in — no auth links in main nav
    : [
        { href: "/login", label: "Sign in", icon: "🔑" },
        { href: "/signup", label: "Create account", icon: "👤" },
      ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl transition-all"
        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--cream)" }}
        aria-expanded={open}
        aria-controls="igp-nav-drawer"
        aria-label="Open menu"
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.12)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000] flex justify-end animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="igp-nav-title">
          <button type="button" className="absolute inset-0" style={{ background: "rgba(5, 10, 7, 0.75)", backdropFilter: "blur(4px)" }} onClick={() => setOpen(false)} aria-label="Close menu" />

          <nav id="igp-nav-drawer" className="animate-slide-right relative flex h-full w-[min(100%,18rem)] flex-col" style={{ background: "var(--surface-1)", borderLeft: "1px solid rgba(255,255,255,0.08)", boxShadow: "var(--shadow-lg)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-black text-[var(--surface-0)]" style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-300))" }}>IG</div>
                <span className="text-sm font-black tracking-tight text-[var(--cream)]" style={{ fontFamily: "var(--font-montserrat)" }} id="igp-nav-title">IGP</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2" style={{ color: "rgba(250,247,240,0.5)" }} aria-label="Close menu">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User info (if signed in) */}
            {user && (
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black text-[var(--surface-0)]" style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-300))" }}>
                    {user.avatar}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--cream)" }}>{user.name}</p>
                    <p className="truncate text-xs" style={{ color: "rgba(250,247,240,0.45)" }}>{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nav items */}
            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {[...NAV_TOP, ...NAV_AUTH].map((item, i) => (
                <li key={item.href} className="animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
                    style={{ color: "rgba(250,247,240,0.75)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--cream)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "rgba(250,247,240,0.75)"; }}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              ))}

              {/* Sign out option when signed in */}
              {user && (
                <li className="mt-2">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); signOut(); }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
                    style={{ color: "rgba(250,100,100,0.8)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#fca5a5"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(250,100,100,0.8)"; }}
                  >
                    <span>🚪</span>
                    Sign out
                  </button>
                </li>
              )}
            </ul>

            {/* Footer CTA */}
            <div className="p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <Link href="/report" onClick={() => setOpen(false)} className="btn-gold flex w-full items-center justify-center gap-2 py-3 text-sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Report an Issue
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
