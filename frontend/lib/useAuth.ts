"use client";

import { useEffect, useState } from "react";
import { clearUser, getUser, onAuthStateChange } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

/**
 * React hook that syncs with Supabase auth state.
 * Returns the current user and a signOut function.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
    void getUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    const unsubscribe = onAuthStateChange((currentUser) => {
      if (active) setUser(currentUser);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signOut = () => {
    void clearUser().finally(() => {
      window.location.href = "/";
    });
  };

  return { user, signOut, mounted: true };
}
