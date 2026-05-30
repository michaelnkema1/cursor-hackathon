"use client";

import { useEffect, useState } from "react";
import { getUser, onAuthChange, signOut as signOutSupabase } from "@/lib/auth";
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
    let active = true;
    setMounted(true);
    getUser()
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = onAuthChange((nextUser) => setUser(nextUser));
    } catch {
      setUser(null);
    }
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signOut = () => {
    void signOutSupabase().finally(() => {
      window.location.href = "/";
    });
  };

  return { user: mounted ? user : null, signOut, mounted };
}
