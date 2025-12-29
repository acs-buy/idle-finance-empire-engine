import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

type RequestBody = {
  type?: "vip" | "offline_boost";
  anonymousId?: string;
};

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const vipPriceId = process.env.STRIPE_PRICE_VIP_MONTHLY;
const offlineBoostPriceId = process.env.STRIPE_PRICE_OFFLINE_BOOST_24H;

function getStripeClient(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey, {
    apiVersion: "2024-06-20",
  });
}

async function getOrigin(): Promise<string> {
  const headersList = await headers();
  const origin = headersList.get("origin");
  if (origin) return origin;
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productType = body.type;
  const anonymousId = body.anonymousId;
  if (productType !== "vip" && productType !== "offline_boost") {
    return NextResponse.json({ error: "Invalid product type" }, { status: 400 });
  }
  if (!anonymousId) {
    return NextResponse.json({ error: "Missing anonymousId" }, { status: 400 });
  }

  const origin = await getOrigin();
  const successUrl = `${origin}/play?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/play?checkout=cancel`;

  try {
    if (productType === "vip") {
      if (!vipPriceId) {
        return NextResponse.json(
        { error: "Missing STRIPE_PRICE_VIP_MONTHLY" },
        { status: 500 },
      );
    }

      const baseMetadata = {
        type: "vip",
        anonymousId,
        productId: "vip_monthly",
      };
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: vipPriceId,
            quantity: 1,
          },
        ],
        metadata: {
          ...baseMetadata,
        },
        subscription_data: {
          metadata: {
            ...baseMetadata,
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      if (!session.url) {
        return NextResponse.json(
          { error: "Missing checkout session URL" },
          { status: 500 },
        );
      }

      return NextResponse.json({ url: session.url });
    }

    if (!offlineBoostPriceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_OFFLINE_BOOST_24H" },
        { status: 500 },
      );
    }

    const baseMetadata = {
      type: "offline_boost",
      anonymousId,
      productId: "offline_boost_24h",
    };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: offlineBoostPriceId,
          quantity: 1,
        },
      ],
      metadata: {
        ...baseMetadata,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Missing checkout session URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: "Stripe session creation failed" },
      { status: 500 },
    );
  }
}
