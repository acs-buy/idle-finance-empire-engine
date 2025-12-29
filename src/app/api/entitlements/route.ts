import { NextResponse } from "next/server";
import { getEntitlements } from "@/server/entitlementsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");

  if (!anonymousId) {
    return NextResponse.json({ error: "Missing anonymousId" }, { status: 400 });
  }

  const entitlements = await getEntitlements(anonymousId);
  return NextResponse.json(entitlements);
}
