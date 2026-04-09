"use client";

/**
 * Very lightweight client-side auth store using localStorage.
 * In a real app this would use Supabase JWT tokens.
 * For the demo: sign-in stores user info, sign-out clears it.
 */

export type AuthUser = {
  name: string;
  email: string;
  avatar: string; // first letter of name
};

const KEY = "igp_demo_user";

export function saveUser(name: string, email: string) {
  if (typeof window === "undefined") return;
  const user: AuthUser = { name, email, avatar: name.charAt(0).toUpperCase() };
  localStorage.setItem(KEY, JSON.stringify(user));
  // Dispatch a custom event so all tabs/components know
  window.dispatchEvent(new Event("igp_auth_change"));
}

export function clearUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("igp_auth_change"));
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}
