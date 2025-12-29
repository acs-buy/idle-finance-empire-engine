import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  findEntitlementsByStripeIds,
  getEntitlements,
  upsertEntitlements,
} from "@/server/entitlementsStore";
import { normalizeVip } from "@/entitlements";
import { createServerClient } from "@/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

type SubscriptionLike = {
  id: string;
  customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  status?: Stripe.Subscription.Status | "incomplete_expired";
  current_period_end?: number;
  metadata?: Stripe.Metadata;
};

function getStripeClient(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

export async function POST(request: Request): Promise<NextResponse> {
  const stripe = getStripeClient();
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe secrets" },
      { status: 500 },
    );
  }

  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const now = Date.now();
  let supabase: ReturnType<typeof createServerClient> | null = null;
  try {
    supabase = createServerClient();
  } catch (error) {
    console.error("[stripe webhook] supabase client init failed", error);
  }

  const insertRevenueEvent = async (payload: {
    stripe_event_id: string;
    stripe_type: string;
    event_type?: string | null;
    ts: number;
    amount?: number | null;
    currency?: string | null;
    product_id?: string | null;
    customer_id?: string | null;
    subscription_id?: string | null;
    anonymous_id?: string | null;
    user_id?: string | null;
    raw: Stripe.Event;
  }) => {
    if (!supabase) return;
    const { error } = await supabase.from("revenue_events").upsert(payload, {
      onConflict: "stripe_event_id",
    });
    if (error) {
      console.error("[revenue_events] insert failed", error);
    } else {
      console.log("[revenue_events] insert ok", payload.stripe_event_id);
    }
  };

  const nowMs = Date.now();
  const baseRevenuePayload = {
    stripe_event_id: event.id,
    stripe_type: event.type,
    event_type: event.type,
    ts: nowMs,
    amount: null as number | null,
    currency: null as string | null,
    product_id: null as string | null,
    customer_id: null as string | null,
    subscription_id: null as string | null,
    anonymous_id: null as string | null,
    user_id: null as string | null,
    raw: event,
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    baseRevenuePayload.amount = session.amount_total ?? null;
    baseRevenuePayload.currency = session.currency ?? null;
    baseRevenuePayload.product_id = session.metadata?.productId ?? null;
    baseRevenuePayload.anonymous_id = session.metadata?.anonymousId ?? null;
    baseRevenuePayload.customer_id =
      typeof session.customer === "string" ? session.customer : null;
    baseRevenuePayload.subscription_id =
      typeof session.subscription === "string" ? session.subscription : null;
  } else if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const invoiceSubscription = (
      invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      }
    ).subscription;
    baseRevenuePayload.amount = invoice.amount_paid ?? null;
    baseRevenuePayload.currency = invoice.currency ?? null;
    baseRevenuePayload.customer_id =
      typeof invoice.customer === "string" ? invoice.customer : null;
    baseRevenuePayload.subscription_id =
      typeof invoiceSubscription === "string"
        ? invoiceSubscription
        : invoiceSubscription?.id ?? null;
  }

  if (supabase) {
    await insertRevenueEvent(baseRevenuePayload);
  } else {
    console.error("[revenue_events] skipped insert, missing supabase env");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const productType = session.metadata?.type;
    const customerId = typeof session.customer === "string" ? session.customer : null;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : null;

    let anonymousId = session.metadata?.anonymousId;
    if (!anonymousId) {
      const mapped = await findEntitlementsByStripeIds(customerId, subscriptionId);
      anonymousId = mapped?.anonymousId;
    }

    if (!anonymousId || (productType !== "vip" && productType !== "offline_boost")) {
      console.warn("[stripe webhook] missing metadata", {
        anonymousId,
        productType,
        sessionId: session.id,
      });
      return NextResponse.json({ received: true });
    }

    if (productType === "vip") {
      await upsertEntitlements(anonymousId, {
        isVip: true,
        vipExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
        stripeCustomerId: customerId ?? undefined,
        stripeSubscriptionId: subscriptionId ?? undefined,
      });
    } else {
      const current = await getEntitlements(anonymousId);
      const boostDurationMs = 24 * 60 * 60 * 1000;
      const baseTime = Math.max(current.offlineBoostExpiresAt ?? 0, now);
      await upsertEntitlements(anonymousId, {
        offlineBoostExpiresAt: baseTime + boostDurationMs,
        stripeCustomerId: customerId ?? undefined,
      });
    }

    // revenue insert handled globally for the event
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted" ||
    event.type === "invoice.payment_failed" ||
    event.type === "invoice.paid"
  ) {
    let subscriptionData: SubscriptionLike | null = null;

    if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceSubscription = (
        invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        }
      ).subscription;
      const subscriptionId =
        typeof invoiceSubscription === "string"
          ? invoiceSubscription
          : invoiceSubscription?.id;
      if (typeof subscriptionId === "string") {
        try {
          subscriptionData = await stripe.subscriptions.retrieve(subscriptionId);
        } catch {
          return NextResponse.json({ received: true });
        }
      }
    } else {
      subscriptionData = event.data.object as SubscriptionLike;
    }

    if (!subscriptionData) {
      return NextResponse.json({ received: true });
    }

    const customerId =
      typeof subscriptionData.customer === "string" ? subscriptionData.customer : null;
    const subscriptionId = subscriptionData.id ?? null;

    let anonymousId = subscriptionData.metadata?.anonymousId;
    if (!anonymousId) {
      const mapped = await findEntitlementsByStripeIds(customerId, subscriptionId);
      anonymousId = mapped?.anonymousId;
    }

    if (!anonymousId) {
      console.warn("[stripe webhook] missing anonymousId for subscription", {
        subscriptionId,
        customerId,
      });
      return NextResponse.json({ received: true });
    }

    const subscriptionStatus = subscriptionData.status ?? "canceled";
    const normalizedStatus =
      subscriptionStatus === "incomplete_expired"
        ? "incomplete"
        : subscriptionStatus === "paused" || subscriptionStatus === "unpaid"
        ? "past_due"
        : subscriptionStatus;
    const currentPeriodEndSec = subscriptionData.current_period_end ?? null;

    const normalized = normalizeVip({
      isVip: false,
      vipStatus: normalizedStatus,
      vipCurrentPeriodEnd: currentPeriodEndSec ? currentPeriodEndSec * 1000 : undefined,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId ?? undefined,
    });

    await upsertEntitlements(anonymousId, normalized);

    void subscriptionData;
  }

  return NextResponse.json({ received: true });
}
