"use client";

import { useSyncExternalStore } from "react";
import { getUser, clearUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

/**
 * React hook that syncs with the localStorage auth store.
 * Returns the current user and a signOut function.
 * Automatically re-renders when auth state changes (across components).
 */
function subscribe(onStoreChange: () => void) {
  window.addEventListener("igp_auth_change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("igp_auth_change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot() {
  return JSON.stringify(getUser());
}

function getServerSnapshot() {
  return "null";
}

function parseSnapshot(snapshot: string): AuthUser | null {
  try {
    return JSON.parse(snapshot) as AuthUser | null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = parseSnapshot(snapshot);

  const signOut = () => {
    clearUser();
    window.location.href = "/";
  };

  return { user, signOut, mounted: true };
}
