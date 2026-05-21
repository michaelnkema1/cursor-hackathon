"use client";

import { useEffect, useState } from "react";
import { authUserFromSession, clearUser, getUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase";

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
    void getUser()
      .then(setUser)
      .catch(() => setUser(null));

    try {
      const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
        setUser(authUserFromSession(session));
      });
      return () => data.subscription.unsubscribe();
    } catch {
      setUser(null);
      return undefined;
    }
  }, []);

  const signOut = () => {
    void clearUser().finally(() => {
      window.location.href = "/";
    });
  };

  return { user: mounted ? user : null, signOut, mounted };
}
