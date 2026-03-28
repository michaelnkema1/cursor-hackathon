"use client";

import dynamic from "next/dynamic";

const ReportFormClient = dynamic(
  () =>
    import("@/app/components/ReportForm").then((mod) => mod.ReportForm),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-lg items-center justify-center px-4 py-16">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Loading form…
        </p>
      </div>
    ),
  },
);

export function ReportFormLoader() {
  return <ReportFormClient />;
}
