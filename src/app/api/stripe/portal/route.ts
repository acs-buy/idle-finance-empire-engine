import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getEntitlements } from "@/server/entitlementsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

function getStripeClient(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey, {
    apiVersion: "2024-06-20",
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }

  let body: { anonymousId?: string; stripeCustomerId?: string } = {};
  try {
    body = (await request.json()) as {
      anonymousId?: string;
      stripeCustomerId?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.anonymousId) {
    return NextResponse.json({ error: "Missing anonymousId" }, { status: 400 });
  }

  const entitlements = await getEntitlements(body.anonymousId);
  const customerId = entitlements.stripeCustomerId ?? body.stripeCustomerId;
  if (!customerId) {
    return NextResponse.json(
      { error: "Missing stripeCustomerId" },
      { status: 400 },
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${new URL(request.url).origin}/play`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Missing portal session URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
