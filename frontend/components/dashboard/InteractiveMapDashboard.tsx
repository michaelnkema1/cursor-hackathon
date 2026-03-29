"use client";

import { useEffect, useState } from "react";
import { MapComponentDynamic } from "@/components/MapComponentDynamic";
import { CommunityFeed } from "@/components/dashboard/CommunityFeed";
import { DashboardHamburgerMenu } from "@/components/dashboard/DashboardHamburgerMenu";
import { fetchIssuesFromApi } from "@/lib/reports";
import type { CommunityReport } from "@/lib/reports";

type InteractiveMapDashboardProps = {
  userEmail: string | null;
};

export function InteractiveMapDashboard({
  userEmail,
}: InteractiveMapDashboardProps) {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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
    <div className="flex min-h-dvh flex-col bg-transparent">
      <header className="z-20 shrink-0 px-4 pt-4 sm:px-5 lg:px-6">
        <div className="rounded-[2rem] border border-white/60 bg-white/80 px-4 py-4 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
                Problem Investigator
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                Protected investigation workspace
              </h1>
              <p className="text-xs leading-6 text-slate-600 dark:text-slate-400">
                Signed in as{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {userEmail ?? "active user"}
                </span>
                . The map blends live backend cases with a calmer, clearer triage view for demo day.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <a
                href="/report"
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
              >
                New case
              </a>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {loading ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                    Loading cases...
                  </span>
                ) : loadError ? (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 font-medium text-red-800 dark:bg-red-950/60 dark:text-red-200">
                    {loadError}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                    {reports.length} case{reports.length === 1 ? "" : "s"} loaded
                  </span>
                )}
              </div>
              <DashboardHamburgerMenu userEmail={userEmail} />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-4 py-4 sm:px-5 lg:flex-row lg:px-6">
        <section
          className="relative min-h-[42vh] flex-1 overflow-hidden lg:min-h-0"
          aria-label="Map of open investigation cases"
        >
          <div className="absolute inset-0 bg-linear-to-br from-sky-50/65 to-transparent dark:from-sky-950/20" />
          <div className="relative h-full w-full lg:p-3 lg:pl-4 lg:pt-4">
            <div className="h-full overflow-hidden rounded-[2rem] shadow-[0_24px_90px_rgba(15,23,42,0.12)] ring-1 ring-white/60 dark:ring-slate-800 lg:rounded-r-none">
              <MapComponentDynamic
                selectedId={selectedId}
                onSelectReport={setSelectedId}
              />
            </div>
          </div>
        </section>

        <aside
          className="flex max-h-[48vh] w-full shrink-0 flex-col lg:max-h-none lg:w-[min(100%,420px)] xl:w-[440px]"
          aria-label="Recent investigation cases"
        >
          <div className="min-h-0 flex-1 lg:py-4 lg:pr-4">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] ring-1 ring-white/60 shadow-[0_24px_90px_rgba(15,23,42,0.12)] dark:ring-slate-800">
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
