"use client";

import type { CommunityReport, IssueStatus } from "@/lib/reports";
import { categoryPinColor } from "@/lib/reports";

function statusStyles(status: IssueStatus): string {
  switch (status) {
    case "Reported":
      return "bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-800/60";
    case "Investigating":
      return "bg-sky-100 text-sky-900 ring-sky-200/80 dark:bg-sky-950/60 dark:text-sky-100 dark:ring-sky-800/60";
    case "Resolved":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-800/60";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-200";
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type CommunityFeedProps = {
  reports: CommunityReport[];
  selectedId: string | null;
  onSelectReport: (id: string) => void;
};

export function CommunityFeed({
  reports,
  selectedId,
  onSelectReport,
}: CommunityFeedProps) {
  return (
    <div className="flex h-full min-h-0 flex-col border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-black/40 lg:border-t-0 lg:border-l lg:shadow-none">
      <div className="shrink-0 border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
          Case feed
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Recent problem cases from the live investigation queue
        </p>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
        {reports.map((report) => {
          const active = report.id === selectedId;
          const dot = categoryPinColor(report.category);
          return (
            <li key={report.id}>
              <button
                type="button"
                onClick={() => onSelectReport(report.id)}
                className={`flex w-full items-start gap-2 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                  active
                    ? "border-sky-300 bg-sky-50/90 ring-1 ring-sky-200 dark:border-sky-700 dark:bg-sky-950/40 dark:ring-sky-900"
                    : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                }`}
              >
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
                  style={{ backgroundColor: dot }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {report.category}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${statusStyles(report.status)}`}
                    >
                      {report.status}
                    </span>
                  </span>
                  <span className="mt-1 block font-semibold text-slate-900 dark:text-slate-100">
                    {report.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
                    {report.locationLabel}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {report.description}
                  </span>
                  <span className="mt-2 block text-[10px] text-slate-400 dark:text-slate-500">
                    {formatTime(report.reportedAt)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
