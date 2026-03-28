import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create account | Civic Ghana",
  description: "Join Civic Ghana to report and track infrastructure issues.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Report issues, add photos, and help authorities prioritize fixes in your area."
    >
      <SignupForm />
    </AuthShell>
  );
}
