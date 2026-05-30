import { NextRequest, NextResponse } from "next/server";

function backendBase(): string {
  const configured = process.env.BACKEND_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BACKEND_URL is required in production.");
  }
  return "http://127.0.0.1:8000";
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${backendBase()}/uploads/sign`, {
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload service unavailable" },
      { status: 502 },
    );
  }
}
