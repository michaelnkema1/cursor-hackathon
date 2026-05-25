"use client";

import { getSupabaseBrowserClient, SUPABASE_STORAGE_BUCKET } from "@/lib/supabase";

type SignedUploadResponse = {
  path: string;
  token: string;
};

type CreateReportPayload = {
  lat: number;
  lng: number;
  title?: string | null;
  description?: string | null;
  description_language?: string | null;
  photo_path?: string | null;
};

type CreateReportResponse = {
  issue_id: string;
  message: string;
};

async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }
  if (!data.session?.access_token) {
    throw new Error("Please sign in before submitting a report.");
  }

  return data.session.access_token;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return payload as T;
}

export async function uploadReportPhoto(file: File): Promise<string> {
  const signed = await postJson<SignedUploadResponse>("/api/uploads/sign", {
    filename: file.name || "report-photo.jpg",
  });

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || undefined,
    });

  if (error) {
    throw new Error(error.message);
  }

  return signed.path;
}

export async function createReport(
  payload: CreateReportPayload,
): Promise<CreateReportResponse> {
  return postJson<CreateReportResponse>("/api/reports", payload);
}
