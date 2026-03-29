import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="min-h-dvh bg-transparent">
      <div className="mx-auto grid min-h-dvh max-w-[1440px] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div className="absolute inset-x-0 top-0 h-64 bg-radial-[circle_at_top_left] from-sky-300/25 via-teal-300/10 to-transparent blur-3xl dark:from-sky-700/30 dark:via-teal-700/15" />
          <div className="relative flex h-full flex-col">
            <header className="flex items-center justify-between gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold tracking-[0.24em] uppercase text-slate-900 dark:text-white"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                  PI
                </span>
                Problem Investigator
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold text-slate-700 backdrop-blur-sm transition hover:border-sky-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-sky-600"
              >
                Open workspace
              </Link>
            </header>

            <div className="mt-12 max-w-2xl lg:mt-20">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700 dark:text-sky-300">
                General problem investigator
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300">
                  {subtitle}
                </p>
              ) : null}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Access-controlled workspace
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Teams sign in before they touch the map, evidence flow, or protected API.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Multilingual intake
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Case descriptions can carry language codes for Khaya-powered translation and transcription.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Evidence-ready backend
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Upload images, audio, or video into Supabase storage and attach them to each case.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-auto hidden gap-3 pt-12 sm:flex">
              <div className="rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs font-medium text-slate-700 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                Built for product, ops, safety, facilities, and people issues
              </div>
              <div className="rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs font-medium text-slate-700 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
                Works with Supabase auth, FastAPI, Khaya, and Gemini
              </div>
            </div>
          </div>
        </section>

        <main className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_35px_120px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88 sm:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
