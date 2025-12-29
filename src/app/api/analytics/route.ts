import { NextResponse } from "next/server";
import { createServerClient } from "@/supabase/server";

type AnalyticsBody = {
  event?: string;
  anonymousId?: string;
  path?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  payload?: Record<string, unknown> | null;
  ts?: number;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createServerClient();
  let body: AnalyticsBody = {};

  try {
    body = (await request.json()) as AnalyticsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.event;
  const anonymousId = body.anonymousId;
  if (!event || !anonymousId) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  const ts = typeof body.ts === "number" ? body.ts : Date.now();
  const headers = request.headers;
  const userAgent = headers.get("user-agent") ?? "";
  const deviceType = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)
    ? "mobile"
    : "desktop";
  const country = headers.get("x-vercel-ip-country");
  const buildVersion = process.env.NEXT_PUBLIC_BUILD_VERSION ?? null;
  const authHeader = headers.get("authorization") ?? "";
  let userId: string | null = null;
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user?.id) {
      userId = data.user.id;
    }
  }

  const { error } = await supabase.from("analytics_events").insert({
    ts,
    event,
    event_name: event,
    anonymous_id: anonymousId,
    user_id: userId,
    path: body.path ?? null,
    referrer: body.referrer ?? null,
    utm_source: body.utm_source ?? null,
    utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null,
    utm_term: body.utm_term ?? null,
    utm_content: body.utm_content ?? null,
    device_type: deviceType,
    country,
    build_version: buildVersion,
    payload: body.payload ?? null,
    created_at: new Date(ts).toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "Failed to store event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
