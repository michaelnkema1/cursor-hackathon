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

function getStatusStyle(status: string): { bar: string; badge: string; label: string } {
  switch (status) {
    case "Reported":
      return {
        bar: "var(--status-reported)",
        badge: "status-reported",
        label: "Reported",
      };
    case "Investigating":
      return {
        bar: "var(--status-investigating)",
        badge: "status-investigating",
        label: "Investigating",
      };
    case "Resolved":
      return {
        bar: "var(--status-resolved)",
        badge: "status-resolved",
        label: "Resolved",
      };
    default:
      return { bar: "var(--green-600)", badge: "", label: status };
  }
}

function formatTimeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return iso;
  }
}

const STAT_LABELS: Record<string, string> = {
  Reported: "Reported",
  Investigating: "Active",
  Resolved: "Resolved",
};

export function HomeDashboardClient({ issues, error }: HomeDashboardClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = {
    Reported: issues.filter((i) => i.status === "Reported").length,
    Investigating: issues.filter((i) => i.status === "Investigating").length,
    Resolved: issues.filter((i) => i.status === "Resolved").length,
  };

  return (
    <div className="flex min-h-dvh flex-1 flex-col" style={{ background: "var(--surface-0)" }}>
      {/* ── Header ── */}
      <header
        className="glass-dark relative z-40 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="ghana-stripe h-[3px] w-full" />
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-black text-[var(--surface-0)]"
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
          <DashboardHamburgerMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ── Sidebar ── */}
        <aside
          className="relative z-30 flex max-h-[min(55vh,26rem)] w-full shrink-0 flex-col overflow-hidden lg:max-h-none lg:w-[min(100%,22rem)] lg:overflow-visible"
          style={{
            background: "var(--surface-1)",
            borderRight: "1px solid rgba(255,255,255,0.07)",
          }}
          aria-label="Live reports"
        >
          {/* Sidebar header */}
          <div
            className="shrink-0 px-4 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--cream)]" style={{ fontFamily: "var(--font-montserrat)" }}>
                Live Reports
              </h2>
              <span
                className="animate-pulse-dot h-2 w-2 rounded-full"
                style={{ background: "var(--green-400)" }}
                title="Live"
              />
            </div>

            {/* Stat chips */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["Reported", "Investigating", "Resolved"] as const).map((st) => (
                <div
                  key={st}
                  className="rounded-xl px-2 py-2 text-center"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <p
                    className="text-lg font-black"
                    style={{ fontFamily: "var(--font-montserrat)", color: st === "Reported" ? "var(--status-reported)" : st === "Investigating" ? "var(--status-investigating)" : "var(--status-resolved)" }}
                  >
                    {counts[st]}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium" style={{ color: "rgba(250,247,240,0.5)" }}>
                    {STAT_LABELS[st]}
                  </p>
                </div>
              ))}
            </div>

            {/* Report CTA */}
            <a
              href="/report"
              className="btn-gold mt-3 flex w-full items-center justify-center gap-1.5 py-3 text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Report New Issue
            </a>

            <p className="mt-3">
              <Link
                href="/dashboard"
                className="text-xs font-semibold transition-colors"
                style={{ color: "var(--green-400)" }}
              >
                Open full-screen map dashboard →
              </Link>
            </p>
          </div>

          {/* Issue list */}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
            {error ? (
              <p
                className="rounded-xl border px-3 py-2.5 text-sm animate-fade-in"
                style={{ background: "rgba(220,38,38,0.1)", borderColor: "rgba(220,38,38,0.3)", color: "#fca5a5" }}
                role="alert"
              >
                {error}
              </p>
            ) : issues.length === 0 ? (
              <p className="text-sm" style={{ color: "rgba(250,247,240,0.4)" }}>
                No reports returned.
              </p>
            ) : (
              issues.map((issue) => {
                const id = String(issue.id);
                const active = selectedId === id;
                const style = getStatusStyle(issue.status);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId((prev) => (prev === id ? null : id))}
                    className="w-full overflow-hidden rounded-xl text-left transition-all"
                    style={{
                      background: active ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? "var(--gold-500)" : "rgba(255,255,255,0.08)"}`,
                      boxShadow: active ? "var(--shadow-gold)" : "none",
                      transform: active ? "scale(1.01)" : "scale(1)",
                    }}
                  >
                    {/* Status bar */}
                    <div className="h-[3px] w-full" style={{ background: style.bar }} />
                    <div className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
                        >
                          {style.label}
                        </span>
                        <span className="ml-auto text-[10px]" style={{ color: "rgba(250,247,240,0.4)" }}>
                          {formatTimeAgo(issue.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold leading-snug" style={{ color: "var(--cream)" }}>
                        {issue.title}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "rgba(250,247,240,0.55)" }}>
                        <span className="font-medium" style={{ color: "rgba(250,247,240,0.7)" }}>Type:</span> {issue.type}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Map ── */}
        <main className="relative flex min-h-[50vh] flex-1 flex-col" style={{ background: "var(--surface-0)" }}>
          <MapWrapper selectedId={selectedId} onSelectReport={setSelectedId} />
        </main>
      </div>
    </div>
  );
}
