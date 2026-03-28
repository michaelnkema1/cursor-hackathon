import { HomeDashboardClient } from "@/components/HomeDashboardClient";

export const dynamic = "force-dynamic";

type Issue = {
  id: string | number;
  title: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  timestamp: string;
};

async function getIssues(): Promise<{ issues: Issue[]; error: string | null }> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    `http://localhost:${process.env.PORT ?? "3000"}`;

  try {
    const res = await fetch(`${baseUrl}/api/issues`, { cache: "no-store" });
    if (!res.ok) {
      return {
        issues: [],
        error: `Could not load reports (${res.status}).`,
      };
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return { issues: [], error: "Invalid response from server." };
    }
    return { issues: data as Issue[], error: null };
  } catch {
    return {
      issues: [],
      error:
        "Unable to reach the API. Run ./scripts/dev.sh so Next (3000) and the FastAPI backend (8000) are up.",
    };
  }
}

export default async function Dashboard() {
  const { issues, error } = await getIssues();

  return <HomeDashboardClient issues={issues} error={error} />;
}
