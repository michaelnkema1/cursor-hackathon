import { NextRequest, NextResponse } from "next/server";

type BackendError = {
  detail?: unknown;
};

function backendBaseUrl(): string {
  return process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
}

function detailToMessage(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    return "The report was missing required fields.";
  }
  return "The report could not be submitted.";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Invalid report payload." },
      { status: 400 },
    );
  }

  const headers = new Headers({ "content-type": "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }

  try {
    const res = await fetch(`${backendBaseUrl()}/reports`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = (data as BackendError).detail;
      return NextResponse.json(
        { detail: detailToMessage(detail) },
        { status: res.status },
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { detail: "Could not reach the report service. Please try again." },
      { status: 502 },
    );
  }
}
