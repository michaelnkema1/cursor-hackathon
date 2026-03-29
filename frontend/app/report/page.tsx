import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ReportFormLoader } from "./ReportFormLoader";

export const metadata: Metadata = {
  title: "Log a problem",
  description: "Capture a new case with location, media, and investigative context.",
};

export default async function ReportPage() {
  await requireUser("/report");

  return (
    <div className="min-h-dvh flex-1 bg-transparent">
      <ReportFormLoader />
    </div>
  );
}
