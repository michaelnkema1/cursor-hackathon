import type { Metadata } from "next";
import { DashboardMapLoader } from "./DashboardMapLoader";

export const metadata: Metadata = {
  title: "Map dashboard | Civic Ghana",
  description:
    "Interactive map of community infrastructure reports across Ghana.",
};

export default function DashboardPage() {
  return <DashboardMapLoader />;
}
