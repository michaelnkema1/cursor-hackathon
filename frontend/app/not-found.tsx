import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center"
      style={{ background: "var(--surface-0)" }}
    >
      {/* Decorative bg */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(30,122,64,0.12) 0%, transparent 65%)",
        }}
      />

      <div className="relative">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-[var(--surface-0)]"
            style={{ background: "linear-gradient(135deg, var(--gold-500), var(--gold-300))" }}
          >
            IG
          </div>
        </div>

        {/* 404 */}
        <p
          className="text-8xl font-black tracking-tighter sm:text-[120px]"
          style={{
            fontFamily: "var(--font-montserrat)",
            background: "linear-gradient(135deg, var(--green-400), var(--gold-400))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          404
        </p>

        <h1
          className="mt-4 text-2xl font-black tracking-tight text-[var(--cream)] sm:text-3xl"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: "rgba(250,247,240,0.5)" }}>
          This page doesn&apos;t exist or may have moved. Head back to the map
          and continue reporting infrastructure issues.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="btn-gold flex items-center gap-2 px-6 py-3 text-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to map
          </Link>
          <Link
            href="/report"
            className="rounded-xl px-6 py-3 text-sm font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(250,247,240,0.7)" }}
          >
            Report an issue
          </Link>
        </div>
      </div>
    </div>
  );
}
