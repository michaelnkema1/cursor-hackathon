"use client";

import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type AuthUser = {
  name: string;
  email: string;
  avatar: string; // first letter of name
};

function userToAuthUser(user: User | null): AuthUser | null {
  if (!user?.email) return null;
  const metadataName = user.user_metadata?.full_name;
  const fallbackName = user.email.split("@")[0].replace(/[._-]/g, " ");
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);

  return {
    name,
    email: user.email,
    avatar: name.charAt(0).toUpperCase(),
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new Error(error.message);
  return userToAuthUser(data.user);
}

export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; hasSession: boolean }> {
  const { data, error } = await getSupabaseBrowserClient().auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw new Error(error.message);

  return {
    user: userToAuthUser(data.user),
    hasSession: Boolean(data.session),
  };
}

export async function clearUser(): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getUser(): Promise<AuthUser | null> {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return userToAuthUser(data.session?.user ?? null);
}

export function onAuthStateChange(
  callback: (user: AuthUser | null) => void,
): () => void {
  const {
    data: { subscription },
  } = getSupabaseBrowserClient().auth.onAuthStateChange(
    (_event: string, session: Session | null) => {
      callback(userToAuthUser(session?.user ?? null));
    },
  );

  return () => subscription.unsubscribe();
}
