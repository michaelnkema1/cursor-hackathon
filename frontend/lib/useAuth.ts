"use client";

import { useEffect, useState } from "react";
import { getUser, onAuthChange, signOut as signOutSupabase } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let active = true;
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

  return { user, signOut, mounted: true };
}
