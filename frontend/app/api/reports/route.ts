import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function getBackendBaseUrl() {
  return process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    {
      data: { session },
    },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  if (!user || !session?.access_token) {
    return NextResponse.json({ detail: "Please sign in first." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/reports`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      {
        detail:
          "Could not reach the backend API. Start the FastAPI server on http://127.0.0.1:8000.",
      },
      { status: 503 },
    );
  }
}
