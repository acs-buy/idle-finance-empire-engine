import { NextResponse } from "next/server";
import { createServerClient } from "@/supabase/server";

type LinkBody = {
  anonymousId?: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = createServerClient();
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  let body: LinkBody = {};
  try {
    body = (await request.json()) as LinkBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.anonymousId) {
    return NextResponse.json({ error: "Missing anonymousId" }, { status: 400 });
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = userData.user.id;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("player_links")
    .upsert(
      {
        user_id: userId,
        anonymous_id: body.anonymousId,
        linked_at: now,
        last_seen_at: now,
      },
      { onConflict: "user_id,anonymous_id" },
    );

  if (error) {
    return NextResponse.json({ error: "Failed to link account" }, { status: 500 });
  }

  return NextResponse.json({ linked: true });
}
