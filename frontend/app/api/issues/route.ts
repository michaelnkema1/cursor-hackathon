import { NextResponse } from "next/server";

/** Matches lib/reports.ts IssueCategory */
type IssueCategory =
  | "Systems"
  | "Operations"
  | "Safety"
  | "Facilities"
  | "People";

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

const MOCK_ISSUES: IssueRow[] = [
  {
    id: 1,
    title: "Recurring checkout failure after the latest release",
    type: "Systems",
    status: "Reported",
    lat: 5.6255,
    lng: -0.1342,
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Warehouse power outage disrupting fulfillment",
    type: "Facilities",
    status: "Investigating",
    lat: 5.635,
    lng: -0.16,
    timestamp: new Date().toISOString(),
  },
  {
    id: 3,
    title: "Customer records mismatched in the support queue",
    type: "Operations",
    status: "Reported",
    lat: 6.69,
    lng: -1.62,
    timestamp: new Date().toISOString(),
  },
  {
    id: 4,
    title: "Repeated badge failures at the side entrance",
    type: "Safety",
    status: "Resolved",
    lat: 5.536,
    lng: -0.1969,
    timestamp: new Date().toISOString(),
  },
  {
    id: 5,
    title: "Interview scheduling backlog across recruiting",
    type: "People",
    status: "Investigating",
    lat: 5.65,
    lng: -0.18,
    timestamp: new Date().toISOString(),
  },
  {
    id: 6,
    title: "Mobile app crash during sign-in on Android",
    type: "Systems",
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

function mapCategory(ai: string | null, desc: string | null): IssueCategory {
  const text = `${ai ?? ""} ${desc ?? ""}`.toLowerCase();
  if (/systems?|bug|crash|error|deploy|login|database|checkout|payment|app|api/.test(text))
    return "Systems";
  if (/safety|security|badge|injury|breach|unsafe|fire|threat/.test(text))
    return "Safety";
  if (/facilit|warehouse|office|door|elevator|power|leak|hvac|internet/.test(text))
    return "Facilities";
  if (/people|hiring|interview|staff|team|schedule|training|onboarding/.test(text))
    return "People";
  return "Operations";
}

function backendToRow(b: BackendIssue): IssueRow {
  const title =
    (b.ai_summary && b.ai_summary.trim()) ||
    (b.description && b.description.trim()) ||
    "Problem case";
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

export async function GET() {
  const base =
    process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
  const url = new URL("/issues/nearby", base);
  url.searchParams.set("lat", "5.6037");
  url.searchParams.set("lng", "-0.187");
  url.searchParams.set("radius_m", "500000");

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json(MOCK_ISSUES, {
        headers: { "x-issues-source": "mock-backend-unavailable" },
      });
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json(MOCK_ISSUES, {
        headers: { "x-issues-source": "mock-invalid-backend-json" },
      });
    }
    if (data.length === 0) {
      return NextResponse.json([], { headers: { "x-issues-source": "backend" } });
    }
    const rows = (data as BackendIssue[]).map(backendToRow);
    return NextResponse.json(rows, { headers: { "x-issues-source": "backend" } });
  } catch {
    return NextResponse.json(MOCK_ISSUES, {
      headers: { "x-issues-source": "mock-fetch-failed" },
    });
  }
}
