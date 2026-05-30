import { NextRequest, NextResponse } from "next/server";

function backendBase(): string {
  const configured = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_URL is required in production.");
  }
  return "http://127.0.0.1:8000";
}

async function forwardJson(req: NextRequest, path: string): Promise<NextResponse> {
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const upstream = await fetch(`${backendBase()}${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: await req.text(),
    cache: "no-store",
  });
  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}

export async function POST(req: NextRequest) {
  try {
    return await forwardJson(req, "/reports");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report service unavailable" },
      { status: 502 },
    );
  }
}
