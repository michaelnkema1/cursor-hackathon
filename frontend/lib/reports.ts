export type IssueStatus = "Reported" | "Investigating" | "Resolved";

export type IssueCategory =
  | "Water"
  | "Roads"
  | "Electricity"
  | "Health"
  | "Sanitation";

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
  if (/spintex|osu|oxford|nima|legon|accra|tema|motorway/.test(t))
    return "Greater Accra";
  if (/kejetia|kumasi|ashanti|adum/.test(t)) return "Kumasi area";
  if (/tamale|sagnarigu|northern/.test(t)) return "Northern Region";
  if (/cape coast|takoradi|western/.test(t)) return "Coastal / Western";
  if (/sunyani|brong/.test(t)) return "Bono Region";
  return "Ghana";
}

export function issueApiRowToReport(row: IssueApiRow): CommunityReport {
  return {
    id: String(row.id),
    title: row.title,
    description:
      "Citizen-submitted infrastructure report. Status updates appear as authorities respond.",
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
    case "Water":
      return "#0ea5e9";
    case "Roads":
      return "#d97706";
    case "Electricity":
      return "#7c3aed";
    case "Health":
      return "#e11d48";
    case "Sanitation":
      return "#059669";
    default:
      return "#64748b";
  }
}
