"use client";

import { useEffect, useState } from "react";
import { MapComponentDynamic } from "@/components/MapComponentDynamic";
import { CommunityFeed } from "@/components/dashboard/CommunityFeed";
import { DashboardHamburgerMenu } from "@/components/dashboard/DashboardHamburgerMenu";
import { fetchIssuesFromApi } from "@/lib/reports";
import type { CommunityReport } from "@/lib/reports";

export function InteractiveMapDashboard() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchIssuesFromApi()
      .then((list) => {
        if (cancelled) return;
        setReports(list);
        setSelectedId((prev) => {
          if (prev && list.some((r) => r.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Could not load reports");
        setReports([]);
        setSelectedId(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100 dark:bg-slate-950">
      <header className="z-20 shrink-0 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
              Civic Ghana
            </p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
              Interactive map dashboard
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Live data from <code className="rounded bg-slate-200/80 px-1 py-0.5 text-[10px] dark:bg-slate-800">GET /api/issues</code>{" "}
              — roads, water, power, health, and sanitation.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {loading ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                  Loading reports…
                </span>
              ) : loadError ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 font-medium text-red-800 dark:bg-red-950/60 dark:text-red-200">
                  {loadError}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {reports.length} report{reports.length === 1 ? "" : "s"} loaded
                </span>
              )}
            </div>
            <DashboardHamburgerMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
        <section
          className="relative min-h-[42vh] flex-1 overflow-hidden lg:min-h-0"
          aria-label="Map of Ghana infrastructure reports"
        >
          <div className="absolute inset-0 bg-linear-to-br from-sky-50/50 to-transparent dark:from-sky-950/20" />
          <div className="relative h-full w-full lg:p-3 lg:pl-4 lg:pt-4">
            <div className="h-full overflow-hidden shadow-lg ring-1 ring-slate-200/80 dark:ring-slate-800 lg:rounded-l-2xl lg:rounded-r-none">
              <MapComponentDynamic
                selectedId={selectedId}
                onSelectReport={setSelectedId}
              />
            </div>
          </div>
        </section>

        <aside
          className="flex max-h-[48vh] w-full shrink-0 flex-col lg:max-h-none lg:w-[min(100%,420px)] xl:w-[440px]"
          aria-label="Recent community reports"
        >
          <div className="min-h-0 flex-1 lg:py-4 lg:pr-4">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-t-2xl ring-1 ring-slate-200/80 dark:ring-slate-800 lg:rounded-2xl lg:shadow-lg">
              <CommunityFeed
                reports={reports}
                selectedId={selectedId}
                onSelectReport={setSelectedId}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
