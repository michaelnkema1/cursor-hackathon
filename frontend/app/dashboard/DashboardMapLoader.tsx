"use client";

import dynamic from "next/dynamic";

const InteractiveMapDashboard = dynamic(
  () =>
    import("@/components/dashboard/InteractiveMapDashboard").then(
      (m) => m.InteractiveMapDashboard,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-950">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Loading map...
        </p>
      </div>
    ),
  },
);

type DashboardMapLoaderProps = {
  userEmail: string | null;
};

export function DashboardMapLoader({ userEmail }: DashboardMapLoaderProps) {
  return <InteractiveMapDashboard userEmail={userEmail} />;
}
