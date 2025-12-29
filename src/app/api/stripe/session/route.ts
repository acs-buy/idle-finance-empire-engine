import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntitlements, upsertEntitlements } from "@/server/entitlementsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const vipPriceId = process.env.STRIPE_PRICE_VIP_MONTHLY;
const offlineBoostPriceId = process.env.STRIPE_PRICE_OFFLINE_BOOST_24H;

function getStripeClient(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

export async function GET(request: Request): Promise<NextResponse> {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }

  if (!vipPriceId || !offlineBoostPriceId) {
    return NextResponse.json(
      { error: "Missing Stripe price env vars" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price"],
    });

    const metadataType = session.metadata?.type;
    const anonymousId = session.metadata?.anonymousId;
    const customerId = typeof session.customer === "string" ? session.customer : undefined;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : undefined;

    if (anonymousId) {
      if (metadataType === "vip") {
        await upsertEntitlements(anonymousId, {
          isVip: true,
          vipExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
      } else if (metadataType === "offline_boost") {
        const current = await getEntitlements(anonymousId);
        const boostDurationMs = 24 * 60 * 60 * 1000;
        const baseTime = Math.max(current.offlineBoostExpiresAt ?? 0, Date.now());
        await upsertEntitlements(anonymousId, {
          offlineBoostExpiresAt: baseTime + boostDurationMs,
          stripeCustomerId: customerId,
        });
      } else if (customerId) {
        await upsertEntitlements(anonymousId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        });
      }
    } else if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[stripe session] missing anonymousId", {
        sessionId,
        metadataType,
        customerId,
      });
    }

    if (metadataType === "vip" || metadataType === "offline_boost") {
      return NextResponse.json({
        type: metadataType,
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: subscriptionId ?? null,
      });
    }

    const lineItems = session.line_items?.data ?? [];
    const priceId = lineItems[0]?.price?.id;

    if (priceId === vipPriceId) {
      return NextResponse.json({
        type: "vip",
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: subscriptionId ?? null,
      });
    }
    if (priceId === offlineBoostPriceId) {
      return NextResponse.json({
        type: "offline_boost",
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: subscriptionId ?? null,
      });
    }

    return NextResponse.json({ error: "Unknown price" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve checkout session" },
      { status: 500 },
    );
  }
}
