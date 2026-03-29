import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function getOptionalUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function redirectIfAuthenticated(target = "/dashboard") {
  const user = await getOptionalUser();
  if (user) redirect(target);
}

export async function requireUser(nextPath = "/dashboard") {
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}
