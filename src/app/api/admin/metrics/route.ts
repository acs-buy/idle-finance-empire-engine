import { NextResponse } from "next/server";
import { createServerClient } from "@/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const adminKey = process.env.ADMIN_METRICS_KEY;

export async function GET(request: Request): Promise<NextResponse> {
  const key = request.headers.get("x-admin-key");
  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const now = new Date();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [events7d, events30d] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last7d),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", last30d),
  ]);

  const [revenue7d, revenue30d] = await Promise.all([
    supabase
      .from("revenue_events")
      .select("amount", { count: "exact" })
      .gte("occurred_at", last7d),
    supabase
      .from("revenue_events")
      .select("amount", { count: "exact" })
      .gte("occurred_at", last30d),
  ]);

  const sumAmounts = (rows: { amount: number | null }[] | null) =>
    (rows ?? []).reduce((total, row) => total + (row.amount ?? 0), 0);

  const funnelEvents = ["game_start", "checkout_started", "paid"];
  const funnelCounts: Record<string, number> = {};

  for (const eventName of funnelEvents) {
    const { count } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", eventName)
      .gte("created_at", last30d);
    funnelCounts[eventName] = count ?? 0;
  }

  return NextResponse.json({
    totals: {
      events7d: events7d.count ?? 0,
      events30d: events30d.count ?? 0,
      revenue7d: sumAmounts(revenue7d.data),
      revenue30d: sumAmounts(revenue30d.data),
    },
    funnel: funnelCounts,
  });
}
