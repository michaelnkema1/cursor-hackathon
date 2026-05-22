import { NextResponse } from "next/server";

/** Matches lib/reports.ts IssueCategory */
type IssueCategory =
  | "Water"
  | "Roads"
  | "Electricity"
  | "Health"
  | "Sanitation";

/** Matches lib/reports.ts IssueStatus */
type IssueStatus = "Reported" | "Investigating" | "Resolved";

type IssueRow = {
  id: string | number;
  title: string;
  type: IssueCategory;
  status: IssueStatus;
  lat: number;
  lng: number;
  timestamp: string;
};

type BackendIssue = {
  id: string;
  status: string;
  lat: number;
  lng: number;
  description: string | null;
  ai_category: string | null;
  ai_summary: string | null;
  created_at: string;
};

function mapBackendStatus(s: string): IssueStatus {
  switch (s) {
    case "in_progress":
      return "Investigating";
    case "resolved":
      return "Resolved";
    default:
      return "Reported";
  }
}

function mapCategory(ai: string | null, desc: string | null): IssueCategory {
  const text = `${ai ?? ""} ${desc ?? ""}`.toLowerCase();
  if (/water|leak|pipe|flood|drain|sewage/.test(text)) return "Water";
  if (/electric|power|transformer|cable|light/.test(text)) return "Electricity";
  if (/health|clinic|hospital|waste\s*bio/.test(text)) return "Health";
  if (/trash|dump|sanitation|waste|garbage/.test(text)) return "Sanitation";
  return "Roads";
}

function backendToRow(b: BackendIssue): IssueRow {
  const title =
    (b.ai_summary && b.ai_summary.trim()) ||
    (b.description && b.description.trim()) ||
    "Infrastructure report";
  return {
    id: b.id,
    title,
    type: mapCategory(b.ai_category, b.description),
    status: mapBackendStatus(b.status),
    lat: b.lat,
    lng: b.lng,
    timestamp: b.created_at,
  };
}

function backendUnavailable(source: string, status = 503) {
  return NextResponse.json(
    { error: "Issues backend is unavailable", issues: [] },
    {
      status,
      headers: { "x-issues-source": source },
    },
  );
}

export async function GET() {
  const base =
    process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
  const url = new URL("/issues/nearby", base);
  url.searchParams.set("lat", "5.6037");
  url.searchParams.set("lng", "-0.187");
  // National-scale query (Ghana ~500km); backend allows up to 2_000_000 m
  url.searchParams.set("radius_m", "800000");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return backendUnavailable("backend-unavailable", 502);
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return backendUnavailable("invalid-backend-json", 502);
    }
    if (data.length === 0) {
      return NextResponse.json([], { headers: { "x-issues-source": "backend" } });
    }
    const rows = (data as BackendIssue[]).map(backendToRow);
    return NextResponse.json(rows, { headers: { "x-issues-source": "backend" } });
  } catch {
    return backendUnavailable("fetch-failed");
  }
}
