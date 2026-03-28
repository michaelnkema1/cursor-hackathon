import type { Metadata } from "next";
import { ReportFormLoader } from "./ReportFormLoader";

export const metadata: Metadata = {
  title: "Report an issue | Civic Ghana",
  description: "Submit a new infrastructure report for your community.",
};

export default function ReportPage() {
  return (
    <div className="min-h-dvh flex-1 bg-slate-50 dark:bg-slate-950">
      {/* Client-only mount avoids RSC/HTML vs client bundle drift (hydration mismatches) */}
      <ReportFormLoader />
    </div>
  );
}
