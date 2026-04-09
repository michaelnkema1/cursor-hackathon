"use client";

import Link from "next/link";
import { DashboardHamburgerMenu } from "@/components/dashboard/DashboardHamburgerMenu";
import { useAuth } from "@/lib/useAuth";

export function SiteHeader() {
  const { user, signOut } = useAuth();

  return (
    <header
      className="glass-dark sticky top-0 z-50 shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Ghana stripe accent line */}
      <div className="ghana-stripe h-[3px] w-full" />

      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-[var(--surface-0)]"
            style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-300))" }}
          >
            IG
          </div>
          <span
            className="text-base font-black tracking-tight"
            style={{ fontFamily: "var(--font-montserrat)", color: "var(--cream)" }}
          >
            IGP
            <span className="ml-1.5 hidden text-xs font-medium tracking-wide text-[var(--green-300)] sm:inline">
              Infrastructure Ghana Platform
            </span>
          </span>
        </Link>

        {/* Nav + auth */}
        <div className="flex items-center gap-3">
          <nav className="mr-2 hidden items-center gap-1 md:flex" aria-label="Quick links">
            {[{ href: "/", label: "Map" }, { href: "/dashboard", label: "Dashboard" }].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
                style={{ color: "rgba(250,247,240,0.65)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--cream)"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(250,247,240,0.65)"; (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                {label}
              </Link>
            ))}

            {user ? (
              /* Signed-in state */
              <div className="ml-2 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-[var(--surface-0)]"
                  style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-300))" }}
                  title={user.name}
                >
                  {user.avatar}
                </div>
                <div className="hidden lg:block">
                  <p className="text-xs font-semibold leading-tight" style={{ color: "var(--cream)" }}>{user.name}</p>
                  <p className="text-[10px]" style={{ color: "rgba(250,247,240,0.45)" }}>{user.email}</p>
                </div>
                <button
                  onClick={signOut}
                  className="ml-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                  style={{ color: "rgba(250,247,240,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#fca5a5"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(250,247,240,0.55)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              /* Signed-out state */
              <>
                <Link
                  href="/login"
                  className="ml-1 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all"
                  style={{ borderColor: "rgba(255,255,255,0.15)", color: "var(--cream)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--gold-500)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--gold-300)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--cream)"; }}
                >
                  Sign in
                </Link>
              </>
            )}

            <Link href="/report" className="btn-gold flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Report
            </Link>
          </nav>
          <DashboardHamburgerMenu />
        </div>
      </div>
    </header>
  );
}
