import { NextResponse } from "next/server";
import { callBirdApi } from "@/lib/bird-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const { status, body } = await callBirdApi("/history");
  return NextResponse.json(body, { status });
}
