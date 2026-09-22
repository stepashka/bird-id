import { NextResponse } from "next/server";
import { callBirdApi } from "@/lib/bird-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const { status, body } = await callBirdApi("/identify", {
    method: "POST",
    body: form,
  });
  return NextResponse.json(body, { status });
}
