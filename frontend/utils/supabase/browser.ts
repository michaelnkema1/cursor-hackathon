"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient | null = null;

export function createClient() {
  if (client) return client;

  const { url, publishableKey } = getSupabaseConfig();
  client = createBrowserClient(url, publishableKey);
  return client;
}
