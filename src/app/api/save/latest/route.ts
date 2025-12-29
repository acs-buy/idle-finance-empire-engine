import { NextResponse } from "next/server";
import { createServerClient } from "@/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = createServerClient();
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = data.user.id;
  const { data: save, error: fetchError } = await supabase
    .from("player_saves")
    .select("save_version, save_json, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to load save" }, { status: 500 });
  }

  if (!save) {
    return NextResponse.json({ save: null });
  }

  return NextResponse.json({
    saveVersion: save.save_version,
    saveJson: save.save_json,
    updatedAt: save.updated_at,
  });
}
