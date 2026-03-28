import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 py-16 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
        Civic Ghana
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
        That URL does not exist. Head back to the map or submit a report.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500"
        >
          Map home
        </Link>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Dashboard
        </Link>
        <Link
          href="/report"
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Report issue
        </Link>
      </div>
    </div>
  );
}
