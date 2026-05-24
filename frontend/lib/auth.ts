"use client";

import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type AuthUser = {
  name: string;
  email: string;
  avatar: string; // first letter of name
};

function displayNameFromUser(user: User): string {
  const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }
  return user.email?.split("@")[0].replace(/[._-]/g, " ") || "Citizen";
}

export function authUserFromSession(session: Session | null): AuthUser | null {
  if (!session?.user) return null;
  const name = displayNameFromUser(session.user);
  return {
    name,
    email: session.user.email || "",
    avatar: name.charAt(0).toUpperCase(),
  };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  const user = authUserFromSession(data.session);
  if (!user) throw new Error("Sign-in succeeded but no session was returned.");
  return user;
}

export async function signUpWithPassword(
  name: string,
  email: string,
  password: string,
): Promise<{ signedIn: boolean }> {
  const { data, error } = await getSupabaseBrowserClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw new Error(error.message);
  return { signedIn: Boolean(data.session) };
}

export async function clearUser(): Promise<void> {
  await getSupabaseBrowserClient().auth.signOut();
}

export async function getUser(): Promise<AuthUser | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw new Error(error.message);
  return authUserFromSession(data.session);
}

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.access_token ?? null;
}
