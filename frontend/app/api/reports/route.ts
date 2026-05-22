import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json(
      { detail: "Missing Authorization header" },
      { status: 401 },
    );
  }

  const base =
    process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
  const upstream = await fetch(new URL("/reports", base), {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      Authorization: authorization,
    },
    body: await request.text(),
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "application/json";
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}
