"use client";

import Link from "next/link";
import { useState } from "react";
import { DashboardHamburgerMenu } from "@/components/dashboard/DashboardHamburgerMenu";
import { MapWrapper } from "@/components/MapWrapper";

export type HomeIssue = {
  id: string | number;
  title: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  timestamp: string;
};

type HomeDashboardClientProps = {
  issues: HomeIssue[];
  error: string | null;
};

function cardClassForStatus(status: string): string {
  switch (status) {
    case "Reported":
      return "border-red-400 bg-red-50/95 text-red-900 ring-1 ring-red-200/80 dark:border-red-600 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-900/60";
    case "Investigating":
      return "border-amber-400 bg-amber-50/95 text-amber-950 ring-1 ring-amber-200/80 dark:border-amber-500 dark:bg-amber-950/45 dark:text-amber-50 dark:ring-amber-900/50";
    case "Resolved":
      return "border-emerald-400 bg-emerald-50/95 text-emerald-950 ring-1 ring-emerald-200/80 dark:border-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-900/50";
    default:
      return "border-slate-200 bg-white text-slate-900 ring-1 ring-slate-200/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800";
  }
}

export function HomeDashboardClient({
  issues,
  error,
}: HomeDashboardClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <header className="relative z-40 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
        <span className="text-sm font-bold tracking-tight text-sky-600 dark:text-sky-400">
          Civic Ghana
        </span>
        <DashboardHamburgerMenu />
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside
        className="relative z-30 flex max-h-[min(55vh,24rem)] w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-white lg:max-h-none lg:w-[min(100%,22rem)] lg:overflow-visible lg:border-b-0 lg:border-r dark:border-slate-800 dark:bg-slate-950"
        aria-label="Live reports"
      >
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
            Live Reports
          </h2>
          <div className="mt-3 w-full">
            <a
              href="/report"
              className="block w-full min-h-12 rounded-xl bg-blue-600 px-4 py-3 text-center text-base font-bold text-white shadow-md ring-1 ring-blue-500/30 transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] active:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-700"
            >
              + Report New Issue
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Pulled from{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-slate-800">
              /api/issues
            </code>
          </p>
          <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-500">
            Tap a report to show it on the map. Sign in and more are in the
            top-right menu.
          </p>
          <p className="mt-3">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
            >
              Open full-screen map dashboard →
            </Link>
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
          {error ? (
            <p
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
              role="alert"
            >
              {error}
            </p>
          ) : issues.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No reports returned.
            </p>
          ) : (
            issues.map((issue) => {
              const id = String(issue.id);
              const active = selectedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setSelectedId((prev) => (prev === id ? null : id))
                  }
                  className={`w-full rounded-xl border-2 p-3 text-left shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${cardClassForStatus(issue.status)} ${
                    active
                      ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-sky-400 dark:ring-offset-slate-950"
                      : ""
                  }`}
                >
                  {/* Use only phrasing content inside <button> (no <p>/<h3>/<div>) to avoid DOM repair + hydration errors */}
                  <span className="block text-[10px] font-bold uppercase tracking-wide">
                    {issue.status}
                  </span>
                  <span className="mt-1.5 block text-sm font-semibold leading-snug">
                    {issue.title}
                  </span>
                  <span className="mt-2 block text-xs opacity-90">
                    <span className="font-semibold">Type:</span> {issue.type}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>
      <main className="relative flex min-h-[50vh] flex-1 flex-col bg-slate-100 dark:bg-slate-900">
        <MapWrapper
          selectedId={selectedId}
          onSelectReport={setSelectedId}
        />
      </main>
      </div>
    </div>
  );
}
