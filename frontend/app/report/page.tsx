import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportFormLoader } from "./ReportFormLoader";

export const metadata: Metadata = {
  title: "Report an issue | Civic Ghana",
  description: "Submit a new infrastructure report for your community.",
};

export default function ReportPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      <SiteHeader />
      <ReportFormLoader />
    </div>
  );
}
