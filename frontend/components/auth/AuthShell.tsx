import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh" style={{ background: "var(--surface-0)" }}>
      {/* ── Left hero panel (desktop only) ── */}
      <div
        className="relative hidden w-[45%] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex xl:w-[42%]"
        style={{ background: "var(--surface-1)" }}
      >
        {/* Decorative background pattern */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top left, rgba(30,122,64,0.35) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(212,160,23,0.15) 0%, transparent 55%)",
          }}
        />
        {/* Top stripe */}
        <div className="ghana-stripe absolute inset-x-0 top-0 h-1" />

        {/* Brand logo */}
        <Link href="/" className="relative flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-[var(--surface-0)]"
            style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-300))" }}
          >
            IG
          </div>
          <div>
            <p
              className="text-lg font-black tracking-tight text-[var(--cream)]"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              IGP
            </p>
            <p className="text-[10px] font-medium tracking-wider" style={{ color: "var(--green-400)" }}>
              Infrastructure Ghana Platform
            </p>
          </div>
        </Link>

        {/* Middle content */}
        <div className="relative">
          <p
            className="text-3xl font-black leading-tight text-[var(--cream)] xl:text-4xl"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Report.
            <br />
            <span style={{ color: "var(--gold-400)" }}>Track.</span>
            <br />
            Fix Ghana.
          </p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed" style={{ color: "rgba(250,247,240,0.6)" }}>
            Join thousands of citizens helping authorities prioritize and fix
            infrastructure issues across Ghana — powered by AI triage.
          </p>

          {/* Stats row */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { value: "5K+", label: "Reports filed" },
              { value: "82%", label: "Resolution rate" },
              { value: "10", label: "regions covered" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p
                  className="text-xl font-black"
                  style={{ fontFamily: "var(--font-montserrat)", color: "var(--gold-400)" }}
                >
                  {value}
                </p>
                <p className="mt-0.5 text-[10px] font-medium" style={{ color: "rgba(250,247,240,0.45)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <blockquote
          className="relative border-l-2 pl-4 text-xs italic leading-relaxed"
          style={{ borderColor: "var(--gold-500)", color: "rgba(250,247,240,0.45)" }}
        >
          &ldquo;Every report is a voice demanding change.&rdquo;
        </blockquote>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <header
          className="flex shrink-0 items-center justify-between px-4 py-3 lg:hidden"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "var(--surface-1)" }}
        >
          <Link href="/" className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-[var(--surface-0)]"
              style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-300))" }}
            >
              IG
            </div>
            <span
              className="text-sm font-black tracking-tight text-[var(--cream)]"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              IGP
            </span>
          </Link>
          <div className="flex gap-3 text-xs font-medium" style={{ color: "rgba(250,247,240,0.55)" }}>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/">Map</Link>
          </div>
        </header>

        {/* Form content */}
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <p
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--gold-400)" }}
            >
              Account
            </p>
            <h1
              className="mt-2 text-2xl font-black tracking-tight text-[var(--cream)] sm:text-3xl"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(250,247,240,0.55)" }}>
                {subtitle}
              </p>
            )}

            {/* Form card */}
            <div
              className="mt-7 rounded-2xl p-6 sm:p-8"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
