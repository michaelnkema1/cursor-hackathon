"use client";

import { useSyncExternalStore } from "react";
import { getUser, clearUser } from "@/lib/auth";

/**
 * React hook that syncs with the localStorage auth store.
 * Returns the current user and a signOut function.
 * Automatically re-renders when auth state changes (across components).
 */
export function useAuth() {
  const user = useSyncExternalStore(
    (onAuthChange) => {
      window.addEventListener("igp_auth_change", onAuthChange);
      return () => window.removeEventListener("igp_auth_change", onAuthChange);
    },
    getUser,
    () => null,
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const signOut = () => {
    clearUser();
    window.location.href = "/";
  };

  return { user, signOut, mounted };
}
