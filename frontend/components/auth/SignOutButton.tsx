"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/browser";

type SignOutButtonProps = {
  className?: string;
};

export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    setPending(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={className}
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
