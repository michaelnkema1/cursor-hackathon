import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { ReportFormLoader } from "./ReportFormLoader";

export const metadata: Metadata = {
  title: "Report an issue | IGP",
  description: "Submit a new infrastructure report for your community.",
};

export default function ReportPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col" style={{ background: "var(--surface-0)" }}>
      <SiteHeader />
      <ReportFormLoader />
    </div>
  );
}
