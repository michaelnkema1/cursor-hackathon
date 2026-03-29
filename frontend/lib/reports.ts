export type IssueStatus = "Reported" | "Investigating" | "Resolved";

export type IssueCategory =
  | "Systems"
  | "Operations"
  | "Safety"
  | "Facilities"
  | "People";

export type CommunityReport = {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  locationLabel: string;
  lat: number;
  lng: number;
  reportedAt: string;
};

export const ACCRA_CENTER: [number, number] = [5.6037, -0.1870];

export const DEFAULT_ZOOM = 6.5;

/** Shape returned by GET /api/issues */
export type IssueApiRow = {
  id: string | number;
  title: string;
  type: IssueCategory;
  status: IssueStatus;
  lat: number;
  lng: number;
  timestamp: string;
};

function guessLocationLabel(title: string): string {
  const t = title.toLowerCase();
  if (/warehouse|dock|fulfillment/.test(t)) return "Warehouse site";
  if (/office|meeting|badge|entrance/.test(t)) return "Office site";
  if (/mobile|app|checkout|login|deploy|database/.test(t)) return "Digital surface";
  if (/support|customer|queue|ticket/.test(t)) return "Support workflow";
  if (/hiring|interview|staff|team/.test(t)) return "People operations";
  return "Pinned location";
}

export function issueApiRowToReport(row: IssueApiRow): CommunityReport {
  return {
    id: String(row.id),
    title: row.title,
    description:
      "Submitted problem case. Status updates appear as investigators work through it.",
    category: row.type,
    status: row.status,
    locationLabel: guessLocationLabel(row.title),
    lat: row.lat,
    lng: row.lng,
    reportedAt: row.timestamp,
  };
}

export async function fetchIssuesFromApi(): Promise<CommunityReport[]> {
  const res = await fetch("/api/issues", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load issues (${res.status})`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid issues response");
  }
  return (data as IssueApiRow[]).map(issueApiRowToReport);
}

export function categoryPinColor(category: IssueCategory): string {
  switch (category) {
    case "Systems":
      return "#0ea5e9";
    case "Operations":
      return "#d97706";
    case "Safety":
      return "#7c3aed";
    case "Facilities":
      return "#e11d48";
    case "People":
      return "#059669";
    default:
      return "#64748b";
  }
}
