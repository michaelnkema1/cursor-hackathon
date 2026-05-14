import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const base =
    process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
  const url = new URL("/reports", base);
  const authorization = req.headers.get("authorization");

  try {
    const body: unknown = await req.json();
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    }
    return NextResponse.json(
      { detail: text || "Report backend returned an empty response" },
      { status: res.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : "Could not reach the report backend",
      },
      { status: 503 },
    );
  }
}
