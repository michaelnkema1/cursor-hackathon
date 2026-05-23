import { NextRequest, NextResponse } from "next/server";

function backendBaseUrl(): string {
  return process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ detail: "Missing Authorization header" }, { status: 401 });
  }

  const response = await fetch(`${backendBaseUrl()}/uploads/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: await request.text(),
    cache: "no-store",
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}
