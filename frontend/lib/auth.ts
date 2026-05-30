"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar: string; // first letter of name
};

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase auth is not configured.");
  }
  browserClient ??= createClient(url, anonKey);
  return browserClient;
}

function userFromSession(session: Session | null): AuthUser | null {
  const user = session?.user;
  if (!user?.email) return null;
  const rawName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email.split("@")[0].replace(/[._]/g, " ");
  const name = String(rawName).trim() || user.email;
  return {
    id: user.id,
    name,
    email: user.email,
    avatar: name.charAt(0).toUpperCase(),
  };
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  const user = userFromSession(data.session);
  if (!user) throw new Error("Sign-in did not return a session.");
  return user;
}

export async function signUp(name: string, email: string, password: string): Promise<AuthUser> {
  const { data, error } = await getSupabaseBrowserClient().auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error) throw error;
  const user = userFromSession(data.session);
  if (!user) {
    throw new Error("Check your email to confirm the account before signing in.");
  }
  return user;
}

export async function signOut() {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw error;
}

export async function getUser(): Promise<AuthUser | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return userFromSession(data.session);
}

export async function getAccessToken(): Promise<string | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error) throw error;
  return data.session?.access_token ?? null;
}

export function onAuthChange(callback: (user: AuthUser | null) => void) {
  const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
    callback(userFromSession(session));
  });
  return () => data.subscription.unsubscribe();
}
