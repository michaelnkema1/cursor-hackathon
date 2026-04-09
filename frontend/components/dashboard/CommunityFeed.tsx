"use client";

import type { CommunityReport, IssueStatus } from "@/lib/reports";
import { categoryPinColor } from "@/lib/reports";

function statusStyles(status: IssueStatus): string {
  switch (status) {
    case "Reported":
      return "status-reported";
    case "Investigating":
      return "status-investigating";
    case "Resolved":
      return "status-resolved";
    default:
      return "";
  }
}

const CATEGORY_ICONS: Record<string, string> = {
  Water: "💧",
  Roads: "🛣️",
  Electricity: "⚡",
  Health: "🏥",
  Sanitation: "♻️",
};

function formatTimeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return iso;
  }
}

type CommunityFeedProps = {
  reports: CommunityReport[];
  selectedId: string | null;
  onSelectReport: (id: string) => void;
};

export function CommunityFeed({ reports, selectedId, onSelectReport }: CommunityFeedProps) {
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: "var(--surface-1)" }}
    >
      {/* Header */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <h2
            className="text-sm font-bold text-[var(--cream)]"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Community Feed
          </h2>
          <span
            className="animate-pulse-dot h-2 w-2 shrink-0 rounded-full"
            style={{ background: "var(--green-400)" }}
          />
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "rgba(250,247,240,0.45)" }}>
          Infrastructure reports across Ghana
        </p>
      </div>

      {/* List */}
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
        {reports.length === 0 ? (
          <li className="py-8 text-center">
            <p className="text-sm" style={{ color: "rgba(250,247,240,0.4)" }}>
              No reports loaded.
            </p>
          </li>
        ) : (
          reports.map((report, i) => {
            const active = report.id === selectedId;
            const dot = categoryPinColor(report.category);
            const icon = CATEGORY_ICONS[report.category] ?? "📌";
            return (
              <li
                key={report.id}
                className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
              >
                <button
                  type="button"
                  onClick={() => onSelectReport(report.id)}
                  className="group w-full overflow-hidden rounded-xl text-left transition-all"
                  style={{
                    background: active ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? "var(--gold-500)" : "rgba(255,255,255,0.08)"}`,
                    boxShadow: active ? "0 0 0 1px rgba(212,160,23,0.3), var(--shadow-md)" : "none",
                  }}
                >
                  {/* Category colour stripe */}
                  <div className="h-[3px] w-full" style={{ background: dot }} />
                  <div className="flex items-start gap-3 px-3 py-3">
                    {/* Category icon */}
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                      style={{ background: `${dot}22` }}
                    >
                      {icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* Category + status */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: dot }}
                        >
                          {report.category}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusStyles(report.status)}`}
                        >
                          {report.status}
                        </span>
                      </div>
                      {/* Title */}
                      <p
                        className="mt-1 text-sm font-semibold leading-snug"
                        style={{ color: "var(--cream)" }}
                      >
                        {report.title}
                      </p>
                      {/* Location */}
                      <p className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: "rgba(250,247,240,0.5)" }}>
                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {report.locationLabel}
                      </p>
                      {/* Description */}
                      <p
                        className="mt-1.5 line-clamp-2 text-xs leading-relaxed"
                        style={{ color: "rgba(250,247,240,0.45)" }}
                      >
                        {report.description}
                      </p>
                      {/* Time */}
                      <p className="mt-2 text-[10px]" style={{ color: "rgba(250,247,240,0.3)" }}>
                        {formatTimeAgo(report.reportedAt)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
