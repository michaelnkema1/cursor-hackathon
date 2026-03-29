import type { Metadata } from "next";
import { Suspense } from "react";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Problem Investigator and access the investigation workspace.",
};

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      title="Sign in to the investigation workspace"
      subtitle="Start with auth, then move into the live map, evidence uploads, and multilingual case intake flow."
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
