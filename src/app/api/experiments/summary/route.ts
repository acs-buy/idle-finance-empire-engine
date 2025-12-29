import { NextResponse } from "next/server";
import { createServerClient } from "@/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyticsRow = {
  event: string;
  payload: Record<string, unknown> | null;
  ts: number;
  anonymous_id: string | null;
};

type RevenueRow = {
  amount: number | null;
  product_id: string | null;
  anonymous_id: string | null;
  ts: number;
};

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function safeNumber(value: number | null): number {
  return value ?? 0;
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

  const { data: analyticsData, error: analyticsError } = await supabase
    .from("analytics_events")
    .select("event, payload, ts, anonymous_id")
    .gte("ts", fromTs)
    .lte("ts", toTs)
    .in("event", [
      "landing_view",
      "click_play",
      "game_start",
      "vip_placement_shown",
      "vip_placement_clicked",
      "checkout_started",
    ]);

  if (analyticsError) {
    return NextResponse.json(
      { error: "Failed to load analytics events" },
      { status: 500 },
    );
  }

  const { data: revenueData, error: revenueError } = await supabase
    .from("revenue_events")
    .select("amount, product_id, anonymous_id, ts")
    .gte("ts", fromTs)
    .lte("ts", toTs);

  if (revenueError) {
    return NextResponse.json(
      { error: "Failed to load revenue events" },
      { status: 500 },
    );
  }

  const landingVariants: Record<
    string,
    { impressions: number; clicks: number; plays: number }
  > = {
    B: { impressions: 0, clicks: 0, plays: 0 },
    C: { impressions: 0, clicks: 0, plays: 0 },
  };

  const vipVariants: Record<
    string,
    {
      impressions: number;
      clicks: number;
      checkouts: number;
      purchases: number;
      revenue: number;
    }
  > = {
    header: {
      impressions: 0,
      clicks: 0,
      checkouts: 0,
      purchases: 0,
      revenue: 0,
    },
    offline_modal: {
      impressions: 0,
      clicks: 0,
      checkouts: 0,
      purchases: 0,
      revenue: 0,
    },
  };

  const checkoutVariantByAnon: Record<
    string,
    { variant: string; ts: number }
  > = {};

  const analyticsRows = (analyticsData ?? []) as AnalyticsRow[];
  const landingImpressions = new Set<string>();
  const landingClicks = new Set<string>();
  const landingPlays = new Set<string>();
  for (const row of analyticsRows) {
    const payload = row.payload ?? {};
    const experimentKey = payload.experimentKey;
    const variant = payload.variant;
    if (
      row.event === "landing_view" &&
      experimentKey === "landing_v2" &&
      (variant === "B" || variant === "C")
    ) {
      if (row.anonymous_id) {
        landingImpressions.add(`${variant}:${row.anonymous_id}`);
      }
    }
    if (
      row.event === "click_play" &&
      experimentKey === "landing_v2" &&
      (variant === "B" || variant === "C")
    ) {
      if (row.anonymous_id) {
        landingClicks.add(`${variant}:${row.anonymous_id}`);
      }
    }
    if (
      row.event === "game_start" &&
      experimentKey === "landing_v2" &&
      (variant === "B" || variant === "C")
    ) {
      if (row.anonymous_id) {
        landingPlays.add(`${variant}:${row.anonymous_id}`);
      }
    }

    if (
      row.event === "vip_placement_shown" &&
      experimentKey === "vip_placement_v1" &&
      (variant === "header" || variant === "offline_modal")
    ) {
      vipVariants[variant].impressions += 1;
    }
    if (
      row.event === "vip_placement_clicked" &&
      experimentKey === "vip_placement_v1" &&
      (variant === "header" || variant === "offline_modal")
    ) {
      vipVariants[variant].clicks += 1;
    }
    if (row.event === "checkout_started") {
      const vipVariant = payload.vipPlacementVariant;
      const vipExperiment = payload.vipPlacementExperiment;
      const productId =
        typeof payload.productId === "string" ? payload.productId : "";
      if (
        vipExperiment === "vip_placement_v1" &&
        (vipVariant === "header" || vipVariant === "offline_modal") &&
        productId.toLowerCase().includes("vip")
      ) {
        vipVariants[vipVariant].checkouts += 1;
        if (row.anonymous_id) {
          const existing = checkoutVariantByAnon[row.anonymous_id];
          if (!existing || row.ts > existing.ts) {
            checkoutVariantByAnon[row.anonymous_id] = {
              variant: vipVariant,
              ts: row.ts,
            };
          }
        }
      }
    }
  }

  const revenueRows = (revenueData ?? []) as RevenueRow[];
  for (const row of revenueRows) {
    if (!row.product_id || !row.product_id.toLowerCase().includes("vip")) {
      continue;
    }
    const anonymousId = row.anonymous_id ?? "";
    const mapped = checkoutVariantByAnon[anonymousId];
    if (!mapped) continue;
    const variant = mapped.variant;
    if (!vipVariants[variant]) continue;
    vipVariants[variant].purchases += 1;
    vipVariants[variant].revenue += safeNumber(row.amount);
  }

  for (const key of landingImpressions) {
    const [variant] = key.split(":");
    if (landingVariants[variant]) {
      landingVariants[variant].impressions += 1;
    }
  }
  for (const key of landingClicks) {
    const [variant] = key.split(":");
    if (landingVariants[variant]) {
      landingVariants[variant].clicks += 1;
    }
  }
  for (const key of landingPlays) {
    const [variant] = key.split(":");
    if (landingVariants[variant]) {
      landingVariants[variant].plays += 1;
    }
  }

  const landingSummary = Object.fromEntries(
    Object.entries(landingVariants).map(([variant, counts]) => {
      const clickRate =
        counts.impressions > 0 ? counts.clicks / counts.impressions : 0;
      const playRate =
        counts.impressions > 0 ? counts.plays / counts.impressions : 0;
      const arpu = counts.plays > 0 ? 0 : 0;
      return [
        variant,
        {
          impressions: counts.impressions,
          clicks: counts.clicks,
          plays: counts.plays,
          checkouts: 0,
          purchases: 0,
          revenue: 0,
          arpu,
          conversion: {
            clickRate,
            playRate,
          },
        },
      ];
    }),
  );

  const vipSummary = Object.fromEntries(
    Object.entries(vipVariants).map(([variant, counts]) => {
      const clickRate =
        counts.impressions > 0 ? counts.clicks / counts.impressions : 0;
      const checkoutRate =
        counts.clicks > 0 ? counts.checkouts / counts.clicks : 0;
      const purchaseRate =
        counts.checkouts > 0 ? counts.purchases / counts.checkouts : 0;
      const arpu =
        counts.impressions > 0 ? counts.revenue / counts.impressions : 0;
      return [
        variant,
        {
          impressions: counts.impressions,
          clicks: counts.clicks,
          plays: 0,
          checkouts: counts.checkouts,
          purchases: counts.purchases,
          revenue: counts.revenue,
          arpu,
          conversion: {
            clickRate,
            checkoutRate,
            purchaseRate,
          },
        },
      ];
    }),
  );

  return NextResponse.json({
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    landing_v2: landingSummary,
    vip_placement_v1: vipSummary,
  });
}
