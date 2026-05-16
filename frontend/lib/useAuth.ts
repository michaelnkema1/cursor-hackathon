"use client";

import { useSyncExternalStore } from "react";
import { clearUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

const AUTH_STORAGE_KEY = "igp_demo_user";

function subscribeToAuth(onStoreChange: () => void) {
  window.addEventListener("igp_auth_change", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("igp_auth_change", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getAuthSnapshot() {
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

function getServerAuthSnapshot() {
  return null;
}

function parseUser(snapshot: string | null): AuthUser | null {
  if (!snapshot) return null;
  try {
    return JSON.parse(snapshot) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * React hook that syncs with the localStorage auth store.
 * Returns the current user and a signOut function.
 * Automatically re-renders when auth state changes (across components).
 */
export function useAuth() {
  const snapshot = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    getServerAuthSnapshot,
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const user = parseUser(snapshot);

  const signOut = () => {
    clearUser();
    window.location.href = "/";
  };

  return { user: mounted ? user : null, signOut, mounted };
}
