import type { Metadata } from "next";
import { Suspense } from "react";
import { redirectIfAuthenticated } from "@/lib/auth/session";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Problem Investigator account for secure intake and follow-up.",
};

export default async function SignupPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      title="Create your investigator account"
      subtitle="Use one account for secure uploads, case tracking, and multilingual problem intake."
    >
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
