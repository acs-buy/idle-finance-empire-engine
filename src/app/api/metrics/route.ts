import { NextResponse } from "next/server";
import { createServerClient } from "@/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const fromDate = parseDate(searchParams.get("from"), defaultFrom);
  const toDate = parseDate(searchParams.get("to"), now);

  const fromTs = fromDate.getTime();
  const toTs = toDate.getTime();

  const playsRes = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event", "game_start")
    .gte("ts", fromTs)
    .lte("ts", toTs);

  if (playsRes.error) {
    return NextResponse.json({ error: "Failed to load plays" }, { status: 500 });
  }

  const checkoutRes = await supabase
    .from("analytics_events")
    .select("payload")
    .eq("event", "checkout_started")
    .gte("ts", fromTs)
    .lte("ts", toTs);

  if (checkoutRes.error) {
    return NextResponse.json(
      { error: "Failed to load checkout events" },
      { status: 500 },
    );
  }

  const revenueRes = await supabase
    .from("revenue_events")
    .select("amount, product_id")
    .gte("ts", fromTs)
    .lte("ts", toTs);

  if (revenueRes.error) {
    return NextResponse.json(
      { error: "Failed to load revenue events" },
      { status: 500 },
    );
  }

  const plays = playsRes.count ?? 0;
  const checkoutRows = checkoutRes.data ?? [];
  const vipCheckouts = checkoutRows.filter((row) => {
    const payload = row.payload as { productId?: string } | null;
    return (payload?.productId ?? "").toLowerCase().includes("vip");
  }).length;

  const revenueRows = revenueRes.data ?? [];
  const vipSuccess = revenueRows.filter((row) =>
    (row.product_id ?? "").toLowerCase().includes("vip"),
  ).length;
  const revenue = revenueRows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0,
  );

  const conversion = plays > 0 ? vipSuccess / plays : 0;
  const arpu = plays > 0 ? revenue / plays : 0;

  return NextResponse.json({
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    plays,
    vip_checkouts: vipCheckouts,
    vip_success: vipSuccess,
    conversion,
    revenue,
    arpu,
  });
}
