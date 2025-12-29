import { Redis } from "@upstash/redis";

export type EntitlementsState = {
  isVip: boolean;
  vipExpiresAt?: number;
  offlineBoostExpiresAt?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  vipStatus?: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  vipCurrentPeriodEnd?: number;
};

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const DEFAULT_ENTITLEMENTS: EntitlementsState = {
  isVip: false,
};

function getRedisClient(): Redis | null {
  if (!redisUrl || !redisToken) return null;
  return new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

function getKey(anonymousId: string): string {
  return `entitlements:${anonymousId}`;
}

export async function getEntitlements(
  anonymousId: string,
): Promise<EntitlementsState> {
  const redis = getRedisClient();
  if (!redis) return { ...DEFAULT_ENTITLEMENTS };

  try {
    const value = await redis.get<Partial<EntitlementsState>>(getKey(anonymousId));
    if (!value) {
      return { ...DEFAULT_ENTITLEMENTS };
    }
    return {
      ...DEFAULT_ENTITLEMENTS,
      ...value,
      isVip: typeof value.isVip === "boolean" ? value.isVip : false,
    };
  } catch {
    return { ...DEFAULT_ENTITLEMENTS };
  }
}

export async function upsertEntitlements(
  anonymousId: string,
  patch: Partial<EntitlementsState>,
): Promise<EntitlementsState> {
  const redis = getRedisClient();
  const current = await getEntitlements(anonymousId);
  const merged: EntitlementsState = {
    ...current,
    ...patch,
    isVip: patch.isVip ?? current.isVip,
  };

  if (!redis) return merged;

  try {
    await redis.set(getKey(anonymousId), merged);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[entitlements] upsert failed", {
        anonymousId,
        patch,
        error,
      });
    }
  }

  return merged;
}

export async function findEntitlementsByStripeIds(
  customerId?: string | null,
  subscriptionId?: string | null,
): Promise<{ anonymousId: string; entitlements: EntitlementsState } | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  if (!customerId && !subscriptionId) return null;

  let cursor = 0;
  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: "entitlements:*",
        count: 50,
      });
      cursor = Number(nextCursor);
      for (const key of keys) {
        const value = await redis.get<Partial<EntitlementsState>>(key);
        if (!value) continue;
        const matchCustomer = customerId && value.stripeCustomerId === customerId;
        const matchSubscription =
          subscriptionId && value.stripeSubscriptionId === subscriptionId;
        if (matchCustomer || matchSubscription) {
          const anonymousId = key.replace("entitlements:", "");
          const entitlements: EntitlementsState = {
            ...DEFAULT_ENTITLEMENTS,
            ...value,
            isVip: typeof value.isVip === "boolean" ? value.isVip : false,
          };
          return { anonymousId, entitlements };
        }
      }
    } while (cursor !== 0);
  } catch {
    return null;
  }

  return null;
}
