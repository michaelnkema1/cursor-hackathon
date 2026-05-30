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
  title: string | null;
  category: string | null;
  created_at: string;
};

const MOCK_ISSUES: IssueRow[] = [
  {
    id: 1,
    title: "Severe Potholes on Spintex Road",
    type: "Roads",
    status: "Reported",
    lat: 5.6255,
    lng: -0.1342,
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Burst Water Main",
    type: "Water",
    status: "Investigating",
    lat: 5.635,
    lng: -0.16,
    timestamp: new Date().toISOString(),
  },
  {
    id: 3,
    title: "Faulty Transformer in Adum",
    type: "Electricity",
    status: "Reported",
    lat: 6.69,
    lng: -1.62,
    timestamp: new Date().toISOString(),
  },
  {
    id: 4,
    title: "Overflowing Community Dumpster",
    type: "Sanitation",
    status: "Resolved",
    lat: 5.536,
    lng: -0.1969,
    timestamp: new Date().toISOString(),
  },
  {
    id: 5,
    title: "Traffic Lights Down at Intersection",
    type: "Roads",
    status: "Investigating",
    lat: 5.65,
    lng: -0.18,
    timestamp: new Date().toISOString(),
  },
  {
    id: 6,
    title: "No Water Supply for 3 Days",
    type: "Water",
    status: "Reported",
    lat: 9.4075,
    lng: -0.8534,
    timestamp: new Date().toISOString(),
  },
];

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
  const configuredBase = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (!configuredBase && process.env.USE_MOCK_ISSUES === "true") {
    return NextResponse.json(MOCK_ISSUES, {
      headers: { "x-issues-source": "mock-explicit" },
    });
  }
  if (!configuredBase && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "BACKEND_URL is required in production." },
      { status: 503, headers: { "x-issues-source": "unconfigured" } },
    );
  }

  const base = configuredBase ?? "http://127.0.0.1:8000";
  const url = new URL("/issues/map", base);
  url.searchParams.set("limit", "500");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Issue service unavailable (${res.status}).` },
        { status: 502, headers: { "x-issues-source": "backend-unavailable" } },
      );
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "Invalid response from issue service." },
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
      { error: "Could not reach issue service." },
      { status: 502, headers: { "x-issues-source": "fetch-failed" } },
    );
  }
}
