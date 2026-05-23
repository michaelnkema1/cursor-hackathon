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
  latitude: number;
  longitude: number;
  category: string | null;
  title: string | null;
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

function mapCategory(category: string | null, title: string | null): IssueCategory {
  const text = `${category ?? ""} ${title ?? ""}`.toLowerCase();
  if (/water|leak|pipe|flood|drain|sewage/.test(text)) return "Water";
  if (/electric|power|transformer|cable|light/.test(text)) return "Electricity";
  if (/health|clinic|hospital|waste\s*bio/.test(text)) return "Health";
  if (/trash|dump|sanitation|waste|garbage/.test(text)) return "Sanitation";
  return "Roads";
}

function backendToRow(b: BackendIssue): IssueRow {
  const title = (b.title && b.title.trim()) || "Infrastructure report";
  return {
    id: b.id,
    title,
    type: mapCategory(b.category, b.title),
    status: mapBackendStatus(b.status),
    lat: b.latitude,
    lng: b.longitude,
    timestamp: b.created_at,
  };
}

export async function GET() {
  const base =
    process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
  const url = new URL("/issues/map", base);
  url.searchParams.set("limit", "500");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { detail: "Backend issues API unavailable" },
        { status: 502, headers: { "x-issues-source": "backend-unavailable" } },
      );
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { detail: "Invalid issues response from backend" },
        { status: 502, headers: { "x-issues-source": "invalid-backend-json" } },
      );
    }
    if (data.length === 0) {
      return NextResponse.json([], { headers: { "x-issues-source": "backend" } });
    }
    const rows = (data as BackendIssue[]).map(backendToRow);
    return NextResponse.json(rows, { headers: { "x-issues-source": "backend" } });
  } catch {
    return NextResponse.json(
      { detail: "Could not reach backend issues API" },
      { status: 502, headers: { "x-issues-source": "fetch-failed" } },
    );
  }
}
