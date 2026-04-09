"use client";

import { useEffect, useState } from "react";
import { MapComponentDynamic } from "@/components/MapComponentDynamic";
import { CommunityFeed } from "@/components/dashboard/CommunityFeed";
import { DashboardHamburgerMenu } from "@/components/dashboard/DashboardHamburgerMenu";
import { fetchIssuesFromApi } from "@/lib/reports";
import type { CommunityReport } from "@/lib/reports";
import Link from "next/link";

const CATEGORIES = ["All", "Water", "Roads", "Electricity", "Health", "Sanitation"] as const;
type Filter = (typeof CATEGORIES)[number];

const CATEGORY_COLORS: Record<string, string> = {
  Water: "var(--cat-water)",
  Roads: "var(--cat-roads)",
  Electricity: "var(--cat-electricity)",
  Health: "var(--cat-health)",
  Sanitation: "var(--cat-sanitation)",
};

export function InteractiveMapDashboard() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");

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
    return () => { cancelled = true; };
  }, []);

  const filtered =
    filter === "All" ? reports : reports.filter((r) => r.category === filter);

  const counts = {
    All: reports.length,
    Water: reports.filter((r) => r.category === "Water").length,
    Roads: reports.filter((r) => r.category === "Roads").length,
    Electricity: reports.filter((r) => r.category === "Electricity").length,
    Health: reports.filter((r) => r.category === "Health").length,
    Sanitation: reports.filter((r) => r.category === "Sanitation").length,
  };

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--surface-0)" }}>
      {/* ── Top bar ── */}
      <header
        className="glass-dark z-20 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="ghana-stripe h-[3px] w-full" />
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Brand + title */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-[var(--surface-0)]"
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
            <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.15)" }} />
            <div>
              <h1
                className="text-base font-bold text-[var(--cream)] sm:text-lg"
                style={{ fontFamily: "var(--font-montserrat)" }}
              >
                Live Dashboard
              </h1>
              <p className="text-[10px]" style={{ color: "rgba(250,247,240,0.45)" }}>
                Real-time infrastructure data · Ghana
              </p>
            </div>
          </div>

          {/* Status chips + menu */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {loading ? (
              <span className="skeleton h-6 w-28 rounded-full" />
            ) : loadError ? (
              <span
                className="rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(220,38,38,0.12)", borderColor: "rgba(220,38,38,0.3)", color: "#fca5a5" }}
              >
                {loadError}
              </span>
            ) : (
              <>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: "rgba(255,255,255,0.07)", color: "var(--cream)" }}
                >
                  {reports.length} total
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: "rgba(52,211,153,0.1)", color: "var(--status-resolved)" }}
                >
                  {counts["Sanitation"] + counts["Electricity"]} critical types
                </span>
              </>
            )}
            <DashboardHamburgerMenu />
          </div>
        </div>

        {/* ── Category filter pills ── */}
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-3 sm:pb-3"
          style={{ scrollbarWidth: "none" }}
        >
          {CATEGORIES.map((cat) => {
            const active = filter === cat;
            const color = cat === "All" ? "var(--gold-500)" : CATEGORY_COLORS[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: active ? `${color}22` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${active ? color : "rgba(255,255,255,0.09)"}`,
                  color: active ? color : "rgba(250,247,240,0.55)",
                  boxShadow: active ? `0 0 12px ${color}33` : "none",
                }}
              >
                {cat}
                {counts[cat] > 0 && (
                  <span
                    className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px]"
                    style={{ background: active ? `${color}33` : "rgba(255,255,255,0.08)" }}
                  >
                    {counts[cat]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Map + Feed ── */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
        {/* Map */}
        <section
          className="relative min-h-[42vh] flex-1 overflow-hidden lg:min-h-0"
          aria-label="Map of Ghana infrastructure reports"
        >
          <div className="relative h-full w-full lg:p-3 lg:pl-4 lg:pt-3">
            <div
              className="h-full overflow-hidden"
              style={{
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <MapComponentDynamic
                selectedId={selectedId}
                onSelectReport={setSelectedId}
              />
            </div>
          </div>
        </section>

        {/* Feed sidebar */}
        <aside
          className="flex max-h-[48vh] w-full shrink-0 flex-col lg:max-h-none lg:w-[min(100%,400px)] xl:w-[420px]"
          aria-label="Recent community reports"
        >
          <div className="min-h-0 flex-1 lg:py-3 lg:pr-4">
            <div
              className="flex h-full min-h-0 flex-col overflow-hidden"
              style={{
                borderRadius: "var(--radius-lg)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <CommunityFeed
                reports={filtered}
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
