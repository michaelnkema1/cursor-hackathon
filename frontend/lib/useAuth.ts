"use client";

import { useEffect, useState } from "react";
import { getUser, clearUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

/**
 * React hook that syncs with the localStorage auth store.
 * Returns the current user and a signOut function.
 * Automatically re-renders when auth state changes (across components).
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());

    const onAuthChange = () => setUser(getUser());
    window.addEventListener("igp_auth_change", onAuthChange);
    return () => window.removeEventListener("igp_auth_change", onAuthChange);
  }, []);

  const signOut = () => {
    clearUser();
    window.location.href = "/";
  };

  return { user: mounted ? user : null, signOut, mounted };
}
