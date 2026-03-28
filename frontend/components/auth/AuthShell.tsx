import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
};

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-b from-sky-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-lg items-center justify-between sm:max-w-md">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-sky-600 dark:text-sky-400"
          >
            Civic Ghana
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs font-medium">
            <Link
              href="/dashboard"
              className="text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Dashboard
            </Link>
            <Link
              href="/"
              className="text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Back to map
            </Link>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Account
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-slate-200/50 dark:border-slate-800 dark:bg-slate-950 dark:ring-slate-800/50 sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
