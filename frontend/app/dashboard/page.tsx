import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardMapLoader } from "./DashboardMapLoader";

export const metadata: Metadata = {
  title: "Map dashboard",
  description: "Interactive map of active investigations and reported problems.",
};

export default async function DashboardPage() {
  const user = await requireUser();

  return <DashboardMapLoader userEmail={user.email ?? null} />;
}
