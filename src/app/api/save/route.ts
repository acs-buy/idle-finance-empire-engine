import { NextResponse } from "next/server";
import { createServerClient } from "@/supabase/server";

type SaveBody = {
  anonymousId?: string;
  state?: unknown;
  saveJson?: unknown;
  saveVersion?: number;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get("anonymousId");

  if (!anonymousId) {
    return NextResponse.json({ error: "Missing anonymousId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("player_saves")
    .select("id, save_json, updated_at")
    .eq("anonymous_id", anonymousId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load save" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ save: null });
  }

  return NextResponse.json({
    save: data.save_json,
    updatedAt: data.updated_at,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createServerClient();
  let body: SaveBody = {};

  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const anonymousId = body.anonymousId?.trim() ?? "";
  const saveJson = body.saveJson ?? body.state;
  const saveVersion = body.saveVersion ?? 1;

  if (!anonymousId) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }
  if (!Number.isInteger(saveVersion) || saveVersion < 1) {
    return NextResponse.json({ error: "Invalid saveVersion" }, { status: 400 });
  }
  if (!saveJson || typeof saveJson !== "object" || Array.isArray(saveJson)) {
    return NextResponse.json({ error: "Invalid saveJson" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  let userId: string | null = null;
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = data.user.id;
  }

  const { data: existing, error: fetchError } = await supabase
    .from("player_saves")
    .select("id")
    .eq(userId ? "user_id" : "anonymous_id", userId ?? anonymousId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to query save" }, { status: 500 });
  }

  const now = new Date().toISOString();

  if (existing?.id) {
    const { error } = await supabase
      .from("player_saves")
      .update({
        save_json: saveJson,
        save_version: saveVersion,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: "Failed to update save" }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("player_saves").insert({
      anonymous_id: anonymousId,
      user_id: userId,
      save_json: saveJson,
      save_version: saveVersion,
      updated_at: now,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to create save" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
