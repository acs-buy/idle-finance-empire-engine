"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import assetsData from "../../../../data/assets.json";
import upgradesData from "../../../../data/upgrades.json";
import type { Session } from "@supabase/supabase-js";
import {
  buyUpgrade,
  computeDerived,
  createDefaultState,
  canPrestige,
  purchaseAsset,
  tick as tickEngine,
  type DerivedState,
  type EngineConfig,
  type PlayerState,
  type AssetConfig,
  type UpgradeConfig,
  calculateAssetCost,
  calculateBulkCost,
} from "@/game";
import { calculateOfflineEarnings } from "@/game/offline";
import { loadPlayerState, savePlayerState } from "@/storage/persistence";
import {
  ANALYTICS_EVENTS,
  ensureUtmCaptured,
  getOrCreateAnonymousId,
  getUtmData,
  track,
} from "@/analytics/tracker";
import { getOrAssignVariant } from "@/analytics/experiments";
import {
  getActiveEntitlements,
  loadEntitlements,
  saveEntitlements,
  type EntitlementsState,
} from "@/entitlements";
import { createBrowserClient } from "@/supabase/client";
import { getClientConfig } from "@/engine/config/client";

const assets = assetsData.assets as AssetConfig[];
const upgrades = upgradesData.upgrades as UpgradeConfig[];
const gameConfig = getClientConfig();
const supabaseEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const baseEngineConfig: EngineConfig = {
  assets,
  upgrades,
  prestige: {
    prestigeMinNetWorth: gameConfig.economy.prestigeMinNetWorth,
    prestigeDivisor: gameConfig.economy.prestigeDivisor,
    prestigeExponent: gameConfig.economy.prestigeExponent,
    prestigeMultiplierPerPoint: gameConfig.economy.prestigeMultiplier,
  },
};

type TabKey = "dashboard" | "invest" | "upgrades" | "leaderboard";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: gameConfig.game.currency,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: gameConfig.game.currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

const formatKpiMobileValue = (value: number) => formatCurrency(value);


export default function PlayPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24 sm:pb-4">
        <GameShell />
      </div>
    </div>
  );
}

type LeaderboardEntry = {
  rank: number;
  displayName: string | null;
  value: number;
  netWorthValue?: number | null;
  incomeValue?: number | null;
  incomeUnit?: string | null;
  prestigePoints: number;
  updatedAt: string;
  portfolio?: {
    income: Record<string, number>;
    netWorth: Record<string, number>;
  } | null;
};

function GameShell() {
  const [isDemo] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("demo") === "true";
  });
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [state, setState] = useState<PlayerState | null>(null);
  const [derived, setDerived] = useState<DerivedState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [entitlements, setEntitlements] = useState<EntitlementsState | null>(
    null,
  );
  const [offlineModal, setOfflineModal] = useState<{
    open: boolean;
    earned: number;
  }>({ open: false, earned: 0 });
  const [recentlyClickedButtonId, setRecentlyClickedButtonId] = useState<
    string | null
  >(null);
  const [cashPulse, setCashPulse] = useState(false);
  const tickRef = useRef<number>(0);
  const saveRef = useRef<PlayerState | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const trackedFirstPurchase = useRef(false);
  const trackedFirstUpgrade = useRef(false);
  const trackedPrestige = useRef(false);
  const trackedGameStart = useRef(false);
  const trackedVipViewed = useRef(false);
  const clickResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cashPulseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCashRef = useRef<number | null>(null);
  const entitlementsRef = useRef<EntitlementsState | null>(null);
  const [checkoutLoadingType, setCheckoutLoadingType] = useState<
    "vip" | "offline_boost" | null
  >(null);
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "pulled" | "pushed" | "error"
  >("idle");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [saveExitNotice, setSaveExitNotice] = useState<string | null>(null);
  const [landingVariant, setLandingVariant] = useState<"B" | "C">("B");
  const [vipPlacementVariant, setVipPlacementVariant] = useState<
    "header" | "offline_modal"
  >("header");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [mobileKpiTab, setMobileKpiTab] = useState<
    "cash" | "income" | "netWorth"
  >("netWorth");
  const [investCategoryView, setInvestCategoryView] = useState<
    "list" | "detail"
  >("list");
  const [upgradeCategoryView, setUpgradeCategoryView] = useState<
    "list" | "detail"
  >("list");
  const [narrativeMessage, setNarrativeMessage] = useState<string | null>(null);
  const [leaderboardTop, setLeaderboardTop] = useState<LeaderboardEntry[]>([]);
  const [leaderboardMe, setLeaderboardMe] = useState<{
    rank: number | null;
    value: number | null;
    netWorthValue?: number | null;
    incomeValue?: number | null;
    incomeUnit?: string | null;
    prestigePoints: number | null;
    displayName: string | null;
    portfolio?: {
      income: Record<string, number>;
      netWorth: Record<string, number>;
    } | null;
  } | null>(null);
  const [leaderboardStatus, setLeaderboardStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [leaderboardAllocationMode, setLeaderboardAllocationMode] = useState<
    "income" | "netWorth"
  >("income");
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const demoConfig = gameConfig.demo ?? {};
  const demoIncomeMultiplier = isDemo ? demoConfig.incomeMultiplier ?? 100 : 1;
  const demoTickMultiplier = isDemo ? demoConfig.tickMultiplier ?? 100 : 1;
  const demoStartingCash = demoConfig.startingCash ?? 200;
  const engineConfig = useMemo(
    () => ({
      ...baseEngineConfig,
      eventMultiplier: demoIncomeMultiplier,
    }),
    [demoIncomeMultiplier],
  );
  const leaderboardSubmitRef = useRef<number>(0);
  const derivedRef = useRef<DerivedState | null>(null);
  const lastSubmittedNetWorthRef = useRef<number | null>(null);
  const leaderboardRetryRef = useRef(false);
  const previousPrestigeRef = useRef<number>(0);
  const previousVipRef = useRef(false);
  const offlineEarningsRef = useRef(false);
  const vipPlacementShownRef = useRef(false);
  const categoryUnlockRef = useRef<Set<string>>(new Set());
  const categoryIncomeRef = useRef<Set<string>>(new Set());
  const narrativePrestigeRef = useRef<number>(0);
  const cloudLoadRef = useRef(false);
  const linkRef = useRef(false);
  const tabs = useMemo(
    () =>
      [
        { key: "dashboard", label: "Dashboard" },
        { key: "invest", label: "Invest" },
        { key: "upgrades", label: "Upgrades" },
        supabaseEnabled ? { key: "leaderboard", label: "Leaderboard" } : null,
      ].filter(Boolean) as { key: TabKey; label: string }[],
    [],
  );
  const vipConfig = gameConfig.pricing.vip;
  const offlineBoostConfig =
    gameConfig.pricing.boosts.find((boost) => boost.id === "offline_boost_24h") ??
    null;
  const offlineBoostLabel =
    offlineBoostConfig?.label ?? "Boost Offline x3 (24h)";
  const offlineBoostDescription =
    offlineBoostConfig?.description ?? "Boost offline earnings x3 for 24 hours.";

  const categoryOrder = useMemo(
    () => [
      { id: "real_estate", label: "Real Estate" },
      { id: "financial_markets", label: "Financial Markets" },
      { id: "businesses", label: "Businesses" },
      { id: "automation", label: "Automation & Leverage" },
    ],
    [],
  );

  useEffect(() => {
    if (!state) return;
    setDerived(computeDerived(state, engineConfig));
  }, [state]);

  useEffect(() => {
    if (tab !== "invest") {
      setInvestCategoryView("list");
    }
    if (tab !== "upgrades") {
      setUpgradeCategoryView("list");
    }
  }, [tab]);

  useEffect(() => {
    const landing = getOrAssignVariant("landing_v2", ["B", "C"]);
    const vipPlacement = getOrAssignVariant("vip_placement_v1", [
      "header",
      "offline_modal",
    ]);
    setLandingVariant(landing === "C" ? "C" : "B");
    setVipPlacementVariant(
      vipPlacement === "offline_modal" ? "offline_modal" : "header",
    );
  }, []);

  useEffect(() => {
    derivedRef.current = derived;
  }, [derived]);

  useEffect(() => {
    if (!offlineModal.open) return;
    const timer = setTimeout(() => {
      setOfflineModal({ open: false, earned: 0 });
    }, 3000);
    return () => clearTimeout(timer);
  }, [offlineModal.open]);

  useEffect(() => {
    if (!saveExitNotice) return;
    const timer = setTimeout(() => {
      setSaveExitNotice(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [saveExitNotice]);

  useEffect(() => {
    if (!narrativeMessage) return;
    const timer = setTimeout(() => {
      setNarrativeMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [narrativeMessage]);

  useEffect(() => {
    return () => {
      if (clickResetRef.current) {
        clearTimeout(clickResetRef.current);
      }
      if (cashPulseRef.current) {
        clearTimeout(cashPulseRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!supabaseEnabled) return;
    try {
      const client = createBrowserClient();
      supabaseRef.current = client;
      client.auth.getSession().then(({ data }) => {
        setAuthSession(data.session ?? null);
      });
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        setAuthSession(session);
      });
      return () => {
        data.subscription.unsubscribe();
      };
    } catch {
      setAuthStatus("error");
      return;
    }
  }, []);

  useEffect(() => {
    if (entitlements) {
      entitlementsRef.current = entitlements;
    }
  }, [entitlements]);

  const trackEvent = useCallback(
    (
      eventName: typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS],
      payload: Record<string, unknown> = {},
    ) => {
      if (isDemo && eventName !== ANALYTICS_EVENTS.DEMO_VIEW) return;
      track(eventName, payload);
    },
    [isDemo],
  );

  useEffect(() => {
    let alive = true;

    const hydrate = async () => {
      if (isDemo) {
        const base = createDefaultState(engineConfig);
        const initial = { ...base, cash: demoStartingCash, lastSeenAt: Date.now() };
        const entitlementsState: EntitlementsState = { isVip: false };
        entitlementsRef.current = entitlementsState;
        setEntitlements(entitlementsState);
        if (!alive) return;
        setState(initial);
        setDerived(computeDerived(initial, engineConfig));
        saveRef.current = initial;
        setHydrated(true);
        sessionStartRef.current = Date.now();
        trackEvent(ANALYTICS_EVENTS.DEMO_VIEW);
        return;
      }

      ensureUtmCaptured();
      const [saved, storedEntitlements] = await Promise.all([
        loadPlayerState(),
        loadEntitlements(),
      ]);
      const base = createDefaultState(engineConfig);
      const initial =
        saved && saved.schemaVersion === base.schemaVersion
          ? saved
          : { ...base, cash: 200 };

      const now = Date.now();
      const localEntitlements: EntitlementsState = storedEntitlements ?? {
        isVip: false,
      };
      let mergedEntitlements: EntitlementsState = localEntitlements;

      try {
        const anonymousId = getOrCreateAnonymousId();
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[entitlements] fetch", { anonymousId });
        }
        const response = await fetch(
          `/api/entitlements?anonymousId=${encodeURIComponent(anonymousId)}`,
        );
        if (response.ok) {
          const serverEntitlements =
            (await response.json()) as EntitlementsState;
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("[entitlements] server", serverEntitlements);
          }
          mergedEntitlements = {
            ...localEntitlements,
            ...serverEntitlements,
            isVip: Boolean(localEntitlements.isVip || serverEntitlements.isVip),
            vipExpiresAt: Math.max(
              localEntitlements.vipExpiresAt ?? 0,
              serverEntitlements.vipExpiresAt ?? 0,
            ) || undefined,
            offlineBoostExpiresAt: Math.max(
              localEntitlements.offlineBoostExpiresAt ?? 0,
              serverEntitlements.offlineBoostExpiresAt ?? 0,
            ) || undefined,
          };
          await saveEntitlements(mergedEntitlements);
        }
      } catch {
        // ignore network errors
      }

      const activeEntitlements = getActiveEntitlements(mergedEntitlements, now);
      const entitlementsState = mergedEntitlements;
      entitlementsRef.current = entitlementsState;
      setEntitlements(entitlementsState);

      const searchParams = new URLSearchParams(window.location.search);
      const checkoutStatus = searchParams.get("checkout");
      const sessionId = searchParams.get("session_id");
      if (checkoutStatus === "success" && sessionId) {
        try {
          const response = await fetch(
            `/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`,
          );
          if (response.ok) {
            const data = (await response.json()) as {
              type?: "vip" | "offline_boost";
              stripeCustomerId?: string | null;
              stripeSubscriptionId?: string | null;
            };
            if (data.type === "vip") {
              entitlementsState.isVip = true;
              entitlementsState.vipExpiresAt =
                Date.now() + 30 * 24 * 60 * 60 * 1000;
              if (data.stripeCustomerId) {
                entitlementsState.stripeCustomerId = data.stripeCustomerId;
              }
              if (data.stripeSubscriptionId) {
                entitlementsState.stripeSubscriptionId =
                  data.stripeSubscriptionId;
              }
            } else if (data.type === "offline_boost") {
              const boostDurationMs = 24 * 60 * 60 * 1000;
              const baseTime = Math.max(
                entitlementsState.offlineBoostExpiresAt ?? 0,
                Date.now(),
              );
              entitlementsState.offlineBoostExpiresAt =
                baseTime + boostDurationMs;
              if (data.stripeCustomerId) {
                entitlementsState.stripeCustomerId = data.stripeCustomerId;
              }
            }

            entitlementsRef.current = { ...entitlementsState };
            setEntitlements({ ...entitlementsState });
            await saveEntitlements({ ...entitlementsState });
          }
        } catch {
          // ignore
        } finally {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout");
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.toString());
        }
      }
      let updatedModifiers = { ...initial.modifiers };
      if (activeEntitlements.vipActive) {
        updatedModifiers = {
          ...updatedModifiers,
          offlineCapSec: Math.max(updatedModifiers.offlineCapSec, 24 * 60 * 60),
          offlineMultiplier: Math.max(updatedModifiers.offlineMultiplier, 1.1),
        };
      }
      if (activeEntitlements.offlineBoostActive) {
        updatedModifiers = {
          ...updatedModifiers,
          offlineMultiplier: Math.max(updatedModifiers.offlineMultiplier, 3),
        };
      }

      const derivedAtSave = computeDerived(initial, engineConfig);
      const offline = calculateOfflineEarnings(initial, {
        now,
        incomePerSecAtSave: derivedAtSave.incomePerSec,
      });

      const withOffline =
        offline.offlineEarnings > 0
          ? {
              ...initial,
              cash: initial.cash + offline.offlineEarnings,
              lastSeenAt: now,
              modifiers: updatedModifiers,
              entitlements: {
                ...initial.entitlements,
                vipUntil: entitlementsState.vipExpiresAt,
                offlineBoostUntil: entitlementsState.offlineBoostExpiresAt,
              },
            }
          : {
              ...initial,
              lastSeenAt: now,
              modifiers: updatedModifiers,
              entitlements: {
                ...initial.entitlements,
                vipUntil: entitlementsState.vipExpiresAt,
                offlineBoostUntil: entitlementsState.offlineBoostExpiresAt,
              },
            };

      if (!alive) return;

      setState(withOffline);
      setDerived(computeDerived(withOffline, engineConfig));
      saveRef.current = withOffline;
      setHydrated(true);
      sessionStartRef.current = Date.now();

      if (offline.offlineEarnings > 0) {
        setOfflineModal({ open: true, earned: offline.offlineEarnings });
        offlineEarningsRef.current = true;
      }
    };

    void hydrate();

    return () => {
      alive = false;
    };
  }, [isDemo, engineConfig, demoStartingCash, trackEvent]);

  useEffect(() => {
    if (!hydrated || !supabaseEnabled) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const last = tickRef.current || now;
      const dtSec = Math.max(0, (now - last) / 1000) * demoTickMultiplier;
      tickRef.current = now;
      setState((prev) => {
        if (!prev) return prev;
        const next = tickEngine(prev, dtSec, engineConfig);
        saveRef.current = next;
        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [hydrated, tab, demoTickMultiplier]);

  useEffect(() => {
    if (!hydrated || trackedGameStart.current) return;
    trackedGameStart.current = true;
    trackEvent(ANALYTICS_EVENTS.GAME_START, {
      startingCash: saveRef.current?.cash ?? state?.cash ?? 0,
      experimentKey: "landing_v2",
      variant: landingVariant,
    });
  }, [hydrated, landingVariant, state?.cash]);

  useEffect(() => {
    if (!hydrated || trackedVipViewed.current) return;
    const vipActive = getActiveEntitlements(entitlements, Date.now()).vipActive;
    if (vipActive) return;
    if (vipPlacementVariant === "header" && tab === "dashboard") {
      trackedVipViewed.current = true;
      trackEvent(ANALYTICS_EVENTS.VIP_VIEWED, {
        placement: "header",
        experimentKey: "vip_placement_v1",
        variant: vipPlacementVariant,
      });
    }
    if (vipPlacementVariant === "offline_modal" && offlineModal.open) {
      trackedVipViewed.current = true;
      trackEvent(ANALYTICS_EVENTS.VIP_VIEWED, {
        placement: "offline_modal",
        experimentKey: "vip_placement_v1",
        variant: vipPlacementVariant,
      });
    }
  }, [hydrated, tab, entitlements, vipPlacementVariant, offlineModal.open]);

  useEffect(() => {
    if (!hydrated || vipPlacementShownRef.current) return;
    const vipActive = getActiveEntitlements(entitlements, Date.now()).vipActive;
    if (vipActive) return;
    if (vipPlacementVariant === "header") {
      vipPlacementShownRef.current = true;
      trackEvent(ANALYTICS_EVENTS.VIP_PLACEMENT_SHOWN, {
        experimentKey: "vip_placement_v1",
        variant: vipPlacementVariant,
      });
    }
  }, [hydrated, entitlements, vipPlacementVariant]);

  useEffect(() => {
    if (!hydrated || vipPlacementVariant !== "offline_modal") return;
    if (vipPlacementShownRef.current) return;
    const vipActive = getActiveEntitlements(entitlements, Date.now()).vipActive;
    if (vipActive) return;
    if (!offlineModal.open) return;
    vipPlacementShownRef.current = true;
    trackEvent(ANALYTICS_EVENTS.VIP_PLACEMENT_SHOWN, {
      experimentKey: "vip_placement_v1",
      variant: vipPlacementVariant,
    });
  }, [hydrated, entitlements, vipPlacementVariant, offlineModal.open]);

  useEffect(() => {
    if (!hydrated || isDemo) return;
    const interval = setInterval(() => {
      const current = saveRef.current;
      if (!current) return;
      const stamped = { ...current, lastSeenAt: Date.now() };
      void savePlayerState(stamped);
      const ent = entitlementsRef.current;
      if (ent) {
        void saveEntitlements(ent);
      }
    }, 5000);

    const emitSessionEnd = () => {
      const durationSec = Math.floor(
        Math.max(0, (Date.now() - sessionStartRef.current) / 1000),
      );
      const utm = getUtmData();
      const body = JSON.stringify({
        event: ANALYTICS_EVENTS.SESSION_END,
        anonymousId: getOrCreateAnonymousId(),
        payload: { durationSec, tab },
        path: window.location.pathname,
        referrer: document.referrer || undefined,
        utm_source: utm?.source,
        utm_medium: utm?.medium,
        utm_campaign: utm?.campaign,
        utm_term: utm?.term,
        utm_content: utm?.content,
        ts: Date.now(),
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/analytics",
            new Blob([body], { type: "application/json" }),
          );
        } else {
          fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => undefined);
        }
      } catch {
        // ignore
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      emitSessionEnd();
      const current = saveRef.current;
      if (!current) return;
      const stamped = { ...current, lastSeenAt: Date.now() };
      void savePlayerState(stamped);
      const ent = entitlementsRef.current;
      if (ent) {
        void saveEntitlements(ent);
      }
    };

    const handlePageHide = () => {
      emitSessionEnd();
      const current = saveRef.current;
      if (!current) return;
      const stamped = { ...current, lastSeenAt: Date.now() };
      void savePlayerState(stamped);
      const ent = entitlementsRef.current;
      if (ent) {
        void saveEntitlements(ent);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [hydrated, isDemo, tab]);

  const handleBuyAsset = (assetId: string, quantity = 1) => {
    setState((prev) => {
      if (!prev) return prev;
      const beforeTotal = Object.values(prev.assetsOwned).reduce(
        (sum, value) => sum + value,
        0,
      );
      const next = purchaseAsset(prev, assetId, quantity, engineConfig);
      const afterTotal = Object.values(next.assetsOwned).reduce(
        (sum, value) => sum + value,
        0,
      );
      if (!trackedFirstPurchase.current && beforeTotal === 0 && afterTotal > 0) {
        trackedFirstPurchase.current = true;
        trackEvent(ANALYTICS_EVENTS.FIRST_PURCHASE_ASSET, { assetId });
      }
      saveRef.current = next;
      return next;
    });
  };

  const handleBuyUpgrade = (upgradeId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const hadUpgrade = Object.values(prev.upgradesOwned).some(Boolean);
      const next = buyUpgrade(prev, upgradeId, engineConfig);
      const hasUpgrade = Object.values(next.upgradesOwned).some(Boolean);
      if (!trackedFirstUpgrade.current && !hadUpgrade && hasUpgrade) {
        trackedFirstUpgrade.current = true;
        trackEvent(ANALYTICS_EVENTS.FIRST_UPGRADE, { upgradeId });
      }
      saveRef.current = next;
      return next;
    });
  };

  const handleClickFeedback = (buttonId: string) => {
    setRecentlyClickedButtonId(buttonId);
    if (clickResetRef.current) {
      clearTimeout(clickResetRef.current);
    }
    clickResetRef.current = setTimeout(() => {
      setRecentlyClickedButtonId(null);
    }, 250);
  };

  const handleVipPlacementClick = (
    placement: "header" | "offline_modal" | "dashboard",
  ) => {
    trackEvent(ANALYTICS_EVENTS.VIP_PLACEMENT_CLICKED, {
      experimentKey: "vip_placement_v1",
      variant: vipPlacementVariant,
      placement,
    });
    startCheckout("vip");
  };

  const startCheckout = async (productType: "vip" | "offline_boost") => {
    if (isDemo) return;
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
      return;
    }

    trackEvent(ANALYTICS_EVENTS.CHECKOUT_STARTED, {
      productId: productType,
      landingExperiment: "landing_v2",
      landingVariant,
      vipPlacementExperiment: "vip_placement_v1",
      vipPlacementVariant,
    });
    setCheckoutLoadingType(productType);
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: productType,
          anonymousId: getOrCreateAnonymousId(),
        }),
      });

      if (!response.ok) {
        console.warn("Checkout session failed");
        return;
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        console.error("Missing checkout URL in response", data);
        return;
      }

      window.location.assign(data.url);
    } catch (err) {
      console.error("Checkout error", err);
    } finally {
      setCheckoutLoadingType(null);
    }
  };

  const startPortal = async () => {
    if (isDemo) return;
    const anonymousId = getOrCreateAnonymousId();
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anonymousId,
          stripeCustomerId: entitlements?.stripeCustomerId,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        console.error("Portal session failed", response.status, text);
        return;
      }
      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        console.error("Missing portal URL", data);
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      console.error("Portal error", err);
    }
  };

  const handleSaveAndExit = async () => {
    if (!state || isDemo) return;
    trackEvent(ANALYTICS_EVENTS.SAVE_AND_EXIT_CLICKED);
    const stamped = { ...state, lastSeenAt: Date.now() };
    saveRef.current = stamped;
    void savePlayerState(stamped);
    const ent = entitlementsRef.current;
    if (ent) {
      void saveEntitlements(ent);
    }

    const token = authSession?.access_token;
    const anonymousId = getOrCreateAnonymousId();
    let cloudSaved = false;

    if (token) {
      try {
        const response = await fetch("/api/save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            anonymousId,
            saveVersion: stamped.schemaVersion ?? 1,
            saveJson: stamped,
          }),
        });
        if (response.ok) {
          cloudSaved = true;
          trackEvent(ANALYTICS_EVENTS.CLOUD_SAVE_SUCCEEDED);
        }
      } catch {
        // ignore
      }
    }

    if (cloudSaved) {
      setSaveExitNotice("Saved to cloud. You can resume on any device.");
    } else {
      setSaveExitNotice("Saved on this device. Sign in to sync across devices.");
    }

    window.location.assign("/");
  };

  const sendMagicLink = async () => {
    if (!supabaseRef.current || !authEmail) return;
    setAuthStatus("sending");
    const { error } = await supabaseRef.current.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/play`,
      },
    });
    if (error) {
      setAuthStatus("error");
      return;
    }
    setAuthStatus("sent");
  };

  const syncWithServer = async (token?: string) => {
    if (!state) return;
    if (!supabaseEnabled) return;
    setSyncStatus("syncing");
    const anonymousId = getOrCreateAnonymousId();
    const now = Date.now();
    try {
      const response = await fetch(
        `/api/save?anonymousId=${encodeURIComponent(anonymousId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      );
      const payload = (await response.json()) as {
        save?: PlayerState | null;
        updatedAt?: string;
      };

      const remoteState = payload.save ?? null;
      const remoteLastSeen =
        remoteState && typeof remoteState.lastSeenAt === "number"
          ? remoteState.lastSeenAt
          : 0;
      const localLastSeen = state.lastSeenAt ?? 0;

      if (remoteState && remoteLastSeen > localLastSeen) {
        setState(remoteState);
        saveRef.current = remoteState;
        setSyncStatus("pulled");
        setLastSyncAt(now);
        return;
      }

      await fetch("/api/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          anonymousId,
          saveJson: state,
          saveVersion: state.schemaVersion ?? 1,
        }),
      });
      setSyncStatus("pushed");
      setLastSyncAt(now);
    } catch {
      setSyncStatus("error");
    }
  };

  useEffect(() => {
    if (!state || !hydrated) return;
    if (!trackedPrestige.current && canPrestige(state, engineConfig)) {
      trackedPrestige.current = true;
      trackEvent(ANALYTICS_EVENTS.PRESTIGE_UNLOCKED);
    }
  }, [state, hydrated]);


  useEffect(() => {
    if (!supabaseEnabled || tab !== "leaderboard") return;
    const token = authSession?.access_token;
    if (!token) {
      setLeaderboardStatus("idle");
      setLeaderboardTop([]);
      setLeaderboardMe(null);
      return;
    }
    const load = async () => {
      setLeaderboardStatus("loading");
      try {
        const response = await fetch(
          `/api/leaderboard?metric=net_worth&limit=50`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) {
          setLeaderboardStatus("error");
          return;
        }
        const payload = (await response.json()) as {
          top: LeaderboardEntry[];
          me: {
            rank: number | null;
            value: number | null;
            netWorthValue?: number | null;
            incomeValue?: number | null;
            incomeUnit?: string | null;
            prestigePoints: number | null;
            displayName: string | null;
            portfolio?: {
              income: Record<string, number>;
              netWorth: Record<string, number>;
            } | null;
          } | null;
        };
        setLeaderboardTop(payload.top ?? []);
        setLeaderboardMe(payload.me ?? null);
        setLeaderboardStatus("idle");
      } catch {
        setLeaderboardStatus("error");
      }
    };
    void load();
  }, [tab, authSession]);

  useEffect(() => {
    if (!supabaseEnabled || isDemo) return;
    if (!authSession || !hydrated || !state || cloudLoadRef.current) return;
    cloudLoadRef.current = true;
    const token = authSession.access_token;
    const localLastSeen = state.lastSeenAt ?? 0;

    const loadLatest = async () => {
      try {
        const response = await fetch("/api/save/latest", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          saveVersion?: number;
          saveJson?: PlayerState;
          updatedAt?: string;
          save?: null;
        };
        if (!payload.saveJson || !payload.updatedAt) return;
        const remoteUpdatedAt = Date.parse(payload.updatedAt);
        if (Number.isNaN(remoteUpdatedAt) || remoteUpdatedAt <= localLastSeen) {
          return;
        }
        setState(payload.saveJson);
        saveRef.current = payload.saveJson;
        await savePlayerState(payload.saveJson);
        trackEvent(ANALYTICS_EVENTS.CLOUD_SAVE_LOADED);
      } catch {
        // ignore
      }
    };

    void loadLatest();
  }, [authSession, hydrated, state, isDemo]);

  useEffect(() => {
    if (!supabaseEnabled || isDemo) return;
    if (!authSession || !hydrated || !state || linkRef.current) return;
    const token = authSession.access_token;
    const anonymousId = getOrCreateAnonymousId();
    linkRef.current = true;

    const linkAndSync = async () => {
      try {
        await fetch("/api/auth/link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ anonymousId }),
        });
      } catch {
        // ignore link errors
      }

      await syncWithServer(token);
    };

    void linkAndSync();
  }, [authSession, hydrated, state, isDemo]);

  useEffect(() => {
    if (!state) return;
    const lastCash = lastCashRef.current;
    if (lastCash !== null && state.cash > lastCash) {
      setCashPulse(true);
      if (cashPulseRef.current) {
        clearTimeout(cashPulseRef.current);
      }
      cashPulseRef.current = setTimeout(() => {
        setCashPulse(false);
      }, 250);
    }
    lastCashRef.current = state.cash;
  }, [state?.cash]);

  useEffect(() => {
    if (!hydrated || !state) return;
    const prestigePoints = state.prestige.pointsTotal ?? 0;
    const previous = narrativePrestigeRef.current;
    if (prestigePoints > previous) {
      setNarrativeMessage(
        "You restructure your empire and return with stronger systems.",
      );
    }
    narrativePrestigeRef.current = prestigePoints;
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || tab !== "leaderboard" || !state) return;
    const currentPrestige = state.prestige.pointsTotal ?? 0;
    const previousPrestige = previousPrestigeRef.current;
    if (currentPrestige > previousPrestige) {
      leaderboardSubmitRef.current = 0;
      void (async () => {
        const now = Date.now();
        if (now - leaderboardSubmitRef.current < 10_000) return;
      })();
    }
    previousPrestigeRef.current = currentPrestige;
  }, [hydrated, tab, state]);

  useEffect(() => {
    if (!hydrated || tab !== "leaderboard") return;
    const vipActive = getActiveEntitlements(entitlements, Date.now()).vipActive;
    if (!previousVipRef.current && vipActive) {
      leaderboardSubmitRef.current = 0;
      leaderboardRetryRef.current = true;
    }
    previousVipRef.current = vipActive;
  }, [hydrated, tab, entitlements]);

  useEffect(() => {
    if (!hydrated || tab !== "leaderboard") return;
    if (offlineEarningsRef.current) {
      leaderboardSubmitRef.current = 0;
      leaderboardRetryRef.current = true;
      offlineEarningsRef.current = false;
    }
  }, [hydrated, tab]);

  const renderAssetCard = (asset: AssetConfig) => {
    if (!state) return null;
      const owned = state.assetsOwned[asset.id] ?? 0;
      const cost1 = calculateAssetCost(asset.baseCost, asset.costGrowth, owned);
      const cost10 = calculateAssetCost(
        asset.baseCost,
        asset.costGrowth,
        owned + 9,
      );
      const unlocked = isDemo || state.cash >= asset.unlockAtCash || owned > 0;
      const incomeContribution = asset.baseIncomePerSec * owned;
      const unlockGoal = asset.unlockAtCash;
      const cashGap = Math.max(0, unlockGoal - state.cash);
      const progress = unlockGoal > 0 ? Math.min(1, state.cash / unlockGoal) : 1;
      const showRecommended = unlocked && state.cash >= cost1 && owned === 0;

    return (
      <div
        key={asset.id}
        className={`rounded-2xl bg-white/10 p-4 shadow-sm ${
          unlocked ? "" : "opacity-60"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">
                {asset.name}
              </h3>
              {showRecommended && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">Owned: {owned}</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-300">{asset.description}</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <span>Next cost</span>
            <span className="font-semibold text-white">
              {formatCurrency(cost1)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Income / sec</span>
            <span className="font-semibold text-white">
              {formatCurrency(incomeContribution)}
            </span>
          </div>
        </div>
        {!unlocked && (
          <div className="mt-3 space-y-2 text-xs text-emerald-300">
            <p>Unlocks at {formatCurrency(asset.unlockAtCash)}</p>
            <p>You need {formatCurrency(cashGap)} more</p>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-emerald-400/60"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            className={`w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              recentlyClickedButtonId === `${asset.id}-x1`
                ? "ring-2 ring-white/20"
                : ""
            }`}
            disabled={
              !unlocked ||
              state.cash < cost1 ||
              recentlyClickedButtonId === `${asset.id}-x1`
            }
            onClick={() => {
              handleClickFeedback(`${asset.id}-x1`);
              handleBuyAsset(asset.id, 1);
            }}
          >
            Buy x1
          </button>
          <button
            className={`w-full rounded-full bg-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-600/80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              recentlyClickedButtonId === `${asset.id}-x10`
                ? "ring-2 ring-white/20"
                : ""
            }`}
            disabled={
              !unlocked ||
              state.cash < cost10 ||
              recentlyClickedButtonId === `${asset.id}-x10`
            }
            onClick={() => {
              handleClickFeedback(`${asset.id}-x10`);
              handleBuyAsset(asset.id, 10);
            }}
          >
            Buy x10
          </button>
        </div>
      </div>
    );
  };

  const assetsByCategory = useMemo(() => {
    if (!state) return [];
    const categoryMap: Record<string, AssetConfig[]> = {};
    const resolveCategory = (asset: AssetConfig): string => {
      switch (asset.category) {
        case "real_estate":
          return "real_estate";
        case "equity":
        case "fixed_income":
        case "cash":
          return "financial_markets";
        case "crypto":
          return "businesses";
        case "hedge":
          return "automation";
        default:
          return "financial_markets";
      }
    };

    engineConfig.assets.forEach((asset) => {
      const categoryId = resolveCategory(asset);
      if (!categoryMap[categoryId]) {
        categoryMap[categoryId] = [];
      }
      categoryMap[categoryId].push(asset);
    });

    return categoryOrder.map((category) => ({
      ...category,
      assets: categoryMap[category.id] ?? [],
    }));
  }, [state, categoryOrder]);

  const categoryIncome = useMemo(() => {
    if (!state) return { totals: {}, totalIncome: 0 };
    const totals: Record<string, number> = {};
    let totalIncome = 0;
    assetsByCategory.forEach((category) => {
      const income = category.assets.reduce((sum, asset) => {
        const owned = state.assetsOwned[asset.id] ?? 0;
        return sum + asset.baseIncomePerSec * owned;
      }, 0);
      totals[category.id] = income;
      totalIncome += income;
    });
    return { totals, totalIncome };
  }, [state, assetsByCategory]);

  const categoryNetWorth = useMemo(() => {
    if (!state) return { totals: {}, totalValue: 0 };
    const totals: Record<string, number> = {};
    let totalValue = 0;
    assetsByCategory.forEach((category) => {
      const value = category.assets.reduce((sum, asset) => {
        const owned = state.assetsOwned[asset.id] ?? 0;
        return sum + calculateBulkCost(asset.baseCost, asset.costGrowth, 0, owned);
      }, 0);
      totals[category.id] = value;
      totalValue += value;
    });
    return { totals, totalValue };
  }, [state, assetsByCategory]);

  const portfolioSnapshot = useMemo(() => {
    if (!state) return null;
    const totalIncome = categoryIncome.totalIncome;
    const totalValue = categoryNetWorth.totalValue;
    if (totalIncome <= 0 && totalValue <= 0) return null;
    const income: Record<string, number> = {
      realEstate: 0,
      markets: 0,
      business: 0,
      automation: 0,
    };
    const netWorth: Record<string, number> = {
      realEstate: 0,
      markets: 0,
      business: 0,
      automation: 0,
    };

    const mapKey = (id: string) => {
      switch (id) {
        case "real_estate":
          return "realEstate";
        case "financial_markets":
          return "markets";
        case "businesses":
          return "business";
        case "automation":
          return "automation";
        default:
          return "markets";
      }
    };

    categoryOrder.forEach((category) => {
      const key = mapKey(category.id);
      const incomeValue = categoryIncome.totals[category.id] ?? 0;
      const netValue = categoryNetWorth.totals[category.id] ?? 0;
      income[key] = totalIncome > 0 ? incomeValue / totalIncome : 0;
      netWorth[key] = totalValue > 0 ? netValue / totalValue : 0;
    });

    return { income, netWorth };
  }, [state, categoryIncome, categoryNetWorth, categoryOrder]);

  useEffect(() => {
    if (!hydrated || isDemo) return;
    const anonymousId = getOrCreateAnonymousId();
    const token = authSession?.access_token;
    const displayName = authSession?.user?.email?.split("@")[0] ?? undefined;

    const submitScore = async (force = false) => {
      const now = Date.now();
      if (now - leaderboardSubmitRef.current < 10_000) return;
      const currentState = saveRef.current ?? state;
      if (!currentState) return;
      const currentDerived = derivedRef.current;
      const currentNetWorth = currentDerived?.netWorth ?? 0;
      const lastSubmitted = lastSubmittedNetWorthRef.current;
      const netWorthDelta = Math.abs(currentNetWorth - (lastSubmitted ?? 0));
      const shouldSubmit =
        force ||
        leaderboardRetryRef.current ||
        lastSubmitted === null ||
        netWorthDelta >= 1000;

      if (!shouldSubmit) return;

      leaderboardSubmitRef.current = now;
      try {
        const response = await fetch("/api/leaderboard/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            anonymousId,
            metric: "net_worth",
            value: currentNetWorth,
            netWorthValue: currentNetWorth,
            incomeValue: (currentDerived?.incomePerSec ?? 0) * 60,
            incomeUnit: "per_min",
            prestigePoints: currentState.prestige.pointsTotal ?? 0,
            displayName,
            portfolio: portfolioSnapshot ?? undefined,
          }),
        });
        if (response.ok) {
          lastSubmittedNetWorthRef.current = currentNetWorth;
          leaderboardRetryRef.current = false;
        } else {
          leaderboardRetryRef.current = true;
        }
      } catch {
        leaderboardRetryRef.current = true;
      }
    };

    if (tab === "leaderboard") {
      void submitScore();
    }

    const interval =
      tab === "leaderboard"
        ? setInterval(() => {
            void submitScore();
          }, 30000)
        : null;

    const handlePageHide = () => {
      if (tab === "leaderboard") {
        void submitScore();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && tab === "leaderboard") {
        void submitScore();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hydrated, tab, authSession, state, isDemo, portfolioSnapshot, derived]);

  const selectedAllocation = useMemo(() => {
    if (!portfolioSnapshot) return null;
    return leaderboardAllocationMode === "income"
      ? portfolioSnapshot.income
      : portfolioSnapshot.netWorth;
  }, [portfolioSnapshot, leaderboardAllocationMode]);

  const selectedAllocationSegments = useMemo(() => {
    if (!selectedAllocation) return null;
    const map = {
      realEstate: {
        id: "real_estate",
        label: "Real Estate",
        percent: selectedAllocation.realEstate * 100,
      },
      markets: {
        id: "financial_markets",
        label: "Financial Markets",
        percent: selectedAllocation.markets * 100,
      },
      business: {
        id: "businesses",
        label: "Businesses",
        percent: selectedAllocation.business * 100,
      },
      automation: {
        id: "automation",
        label: "Automation & Leverage",
        percent: selectedAllocation.automation * 100,
      },
    };
    return Object.values(map);
  }, [selectedAllocation]);

  const allocationColors: Record<string, string> = {
    real_estate: "bg-sky-400/70",
    financial_markets: "bg-emerald-400/70",
    businesses: "bg-amber-400/70",
    automation: "bg-violet-400/70",
  };

  const mainAllocation = useMemo(() => {
    if (!selectedAllocationSegments || selectedAllocationSegments.length === 0) {
      return null;
    }
    return selectedAllocationSegments.reduce((best, segment) =>
      segment.percent > best.percent ? segment : best,
    );
  }, [selectedAllocationSegments]);

  const renderAllocationLegend = (segments: { id: string; label: string; percent: number }[]) => (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
      {segments.map((segment) => (
        <div key={segment.id} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${allocationColors[segment.id]}`} />
          <span>
            {segment.label} {segment.percent.toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );

  const formatIncomeValue = (value: number, unit: string | null | undefined) => {
    const suffix = unit === "per_min" ? " / min" : unit === "per_sec" ? " / sec" : "";
    return `${formatCurrency(value)}${suffix}`;
  };

  const renderPortfolioSplit = (containerClassName = "") => (
    <div className={`rounded-2xl bg-white/5 p-4 shadow-sm ${containerClassName}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Portfolio Split
        </p>
      </div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/10">
        {assetsByCategory.map((category) => {
          const income = categoryIncome.totals[category.id] ?? 0;
          const total = categoryIncome.totalIncome || 0;
          const percent = total > 0 ? (income / total) * 100 : 0;
          return (
            <div
              key={category.id}
              className={allocationColors[category.id]}
              style={{ width: `${percent}%` }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
        {assetsByCategory.map((category) => {
          const income = categoryIncome.totals[category.id] ?? 0;
          const total = categoryIncome.totalIncome || 0;
          const percent = total > 0 ? (income / total) * 100 : 0;
          return (
            <div key={category.id} className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${allocationColors[category.id]}`}
              />
              <span>
                {category.label} {percent.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTabIcon = (key: TabKey) => {
    switch (key) {
      case "dashboard":
        return (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M3.75 10.5 12 3.75l8.25 6.75v8.25a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-4.5v6H5.25a1.5 1.5 0 0 1-1.5-1.5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "invest":
        return (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M4 19.5h16M6 19.5V8.25m6 11.25V4.5m6 15V12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "upgrades":
        return (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M12 6.75v10.5m-5.25-5.25h10.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4.5 12a7.5 7.5 0 1 0 15 0 7.5 7.5 0 0 0-15 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "leaderboard":
        return (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              d="M6 20.25v-6.75m6 6.75V9.75m6 10.5v-12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const buildShareUrls = () => {
    if (typeof window === "undefined") return null;
    const origin = window.location.origin;
    const anonymousId = getOrCreateAnonymousId();
    const userId = authSession?.user?.id;
    const mode = leaderboardAllocationMode === "income" ? "income" : "netWorth";
    const baseParams = new URLSearchParams({ mode });
    baseParams.set("anonymousId", anonymousId);
    if (userId) {
      baseParams.set("userId", userId);
    }
    const imageUrl = `${origin}/api/share/leaderboard?${baseParams.toString()}`;
    const sharePageUrl = `${origin}/play?utm_source=share&utm_medium=social&utm_campaign=leaderboard`;
    return { imageUrl, sharePageUrl };
  };

  const handleShareDownload = async () => {
    const urls = buildShareUrls();
    if (!urls) return;
    trackEvent(ANALYTICS_EVENTS.SHARE_CLICKED, { action: "download" });
    try {
      const response = await fetch(urls.imageUrl);
      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error("Share download failed", response.status);
        return;
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "idle-finance-leaderboard.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      trackEvent(ANALYTICS_EVENTS.SHARE_DOWNLOADED, {
        mode: leaderboardAllocationMode,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Share download failed", error);
    }
  };

  const handleShareExternal = (channel: "x" | "linkedin") => {
    const urls = buildShareUrls();
    if (!urls) return;
    trackEvent(ANALYTICS_EVENTS.SHARE_SHARED, {
      channel,
      mode: leaderboardAllocationMode,
    });
    const encodedUrl = encodeURIComponent(urls.sharePageUrl);
    const text = encodeURIComponent("Check my Idle Finance Empire rank!");
    const shareUrl =
      channel === "x"
        ? `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!hydrated || !state) return;
    const unlockMessages: Record<string, string> = {
      real_estate: "You’ve unlocked Real Estate — a foundation for long-term wealth.",
      financial_markets:
        "Financial Markets are now open — grow with diversified returns.",
      businesses: "You’ve unlocked Businesses — scalable cash flow begins.",
      automation: "Automation & Leverage are live — let systems do the heavy lifting.",
    };
    const incomeMessages: Record<string, string> = {
      real_estate: "Your Real Estate now generates steady rent income.",
      financial_markets:
        "Your market positions now deliver consistent returns.",
      businesses: "Your businesses now generate sustainable cash flow.",
      automation: "Leverage systems are compounding your income faster.",
    };

    const unlockedCategories = assetsByCategory.filter((category) =>
      category.assets.some((asset) => {
        const owned = state.assetsOwned[asset.id] ?? 0;
        return owned > 0 || state.cash >= asset.unlockAtCash;
      }),
    );

    if (!expandedCategory && unlockedCategories.length > 0) {
      setExpandedCategory(unlockedCategories[0].id);
    }

    unlockedCategories.forEach((category) => {
      if (!categoryUnlockRef.current.has(category.id)) {
        categoryUnlockRef.current.add(category.id);
        const message = unlockMessages[category.id];
        if (message) {
          setNarrativeMessage(message);
        }
      }
    });

    assetsByCategory.forEach((category) => {
      const income = categoryIncome.totals[category.id] ?? 0;
      if (income > 0 && !categoryIncomeRef.current.has(category.id)) {
        categoryIncomeRef.current.add(category.id);
        const message = incomeMessages[category.id];
        if (message) {
          setNarrativeMessage(message);
        }
      }
    });
  }, [hydrated, state, assetsByCategory, categoryIncome, expandedCategory]);

  const assetCardById: Record<string, JSX.Element> = {};
  if (state) {
    engineConfig.assets.forEach((asset) => {
      const card = renderAssetCard(asset);
      if (card) {
        assetCardById[asset.id] = card;
      }
    });
  }

  const renderUpgradeCard = (upgrade: UpgradeConfig) => {
    if (!state) return null;
    const owned = state.upgradesOwned[upgrade.id] ?? false;
    const unlocked = state.cash >= upgrade.unlockAtCash;
    return (
      <div
        key={upgrade.id}
        className={`flex h-full flex-col rounded-2xl bg-white/10 p-4 shadow-sm ${
          unlocked ? "" : "opacity-60"
        }`}
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">{upgrade.name}</h3>
          <p className="text-xs text-slate-400">
            {owned ? "Owned" : `Not owned · ${formatCurrency(upgrade.price)}`}
          </p>
        </div>
        <p className="mt-2 text-sm text-slate-300">{upgrade.description}</p>
        <div className="mt-auto flex items-center gap-3 pt-4">
          <button
            className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={owned || !unlocked || state.cash < upgrade.price}
            onClick={() => handleBuyUpgrade(upgrade.id)}
          >
            {owned ? "Purchased" : "Buy upgrade"}
          </button>
          {!unlocked && (
            <p className="text-xs text-amber-400">
              Unlocks at {formatCurrency(upgrade.unlockAtCash)}
            </p>
          )}
        </div>
      </div>
    );
  };

  const upgradeCategories = useMemo(
    () => [
      { id: "global_multiplier", label: "Global Upgrades" },
      { id: "asset_multiplier", label: "Asset Multipliers" },
    ],
    [],
  );

  const upgradesByCategory = useMemo(() => {
    if (!state) return [];
    const categoryMap: Record<string, UpgradeConfig[]> = {};
    engineConfig.upgrades
      .filter(
        (upgrade) =>
          state.cash >= upgrade.unlockAtCash || state.upgradesOwned[upgrade.id],
      )
      .forEach((upgrade) => {
        const categoryId = upgrade.type;
        if (!categoryMap[categoryId]) {
          categoryMap[categoryId] = [];
        }
        categoryMap[categoryId].push(upgrade);
      });
    return upgradeCategories.map((category) => ({
      ...category,
      upgrades: categoryMap[category.id] ?? [],
    }));
  }, [state, upgradeCategories]);

  const [expandedUpgradeCategory, setExpandedUpgradeCategory] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!expandedUpgradeCategory && upgradesByCategory.length > 0) {
      setExpandedUpgradeCategory(upgradesByCategory[0].id);
    }
  }, [expandedUpgradeCategory, upgradesByCategory]);

  if (!state || !derived) {
    return (
      <div className="rounded-2xl bg-white/5 p-6 text-sm text-slate-300 shadow-sm">
        Loading game state...
      </div>
    );
  }

  const now = Date.now();
  const activeEntitlements = getActiveEntitlements(entitlements, now);

  const formatDuration = (ms: number) => {
    if (ms <= 0) return "0m";
    const totalMinutes = Math.ceil(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatTime = (timestamp: number) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));

  const formatPerMinute = (valuePerSec: number) =>
    formatCurrency(valuePerSec * 60);

  const projectionCue = (incomePerSec: number) => {
    const incomePerHour = incomePerSec * 3600;
    if (incomePerHour >= 5000) {
      return "Comparable to the revenue of a small company.";
    }
    if (incomePerHour >= 1000) {
      return "Equivalent to multiple full-time salaries.";
    }
    if (incomePerHour >= 200) {
      return "Comparable to a strong side hustle.";
    }
    return "Building momentum with every tick.";
  };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
          Play
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-4xl">
            {gameConfig.game.name}
          </h1>
          {activeEntitlements.vipActive && (
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200">
              VIP Active
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!isDemo &&
              !activeEntitlements.vipActive &&
              vipPlacementVariant === "header" && (
                <button
                  className="rounded-full bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm"
                  onClick={() => handleVipPlacementClick("header")}
                >
                  {vipConfig.buttonLabel}
                </button>
              )}
            {!isDemo && (
              <button
                className="hidden rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/15 sm:inline-flex"
                onClick={handleSaveAndExit}
                title={
                  authSession
                    ? "Save locally and to cloud, then exit."
                    : "Save locally only. Sign in to sync across devices."
                }
              >
                Save &amp; Exit
              </button>
            )}
          </div>
        </div>
        {saveExitNotice && (
          <p className="text-xs text-slate-300">{saveExitNotice}</p>
        )}
        {narrativeMessage && (
          <div className="rounded-2xl bg-white/5 px-4 py-2 text-xs text-slate-200">
            {narrativeMessage}
          </div>
        )}
        <p className="text-sm text-slate-300">
          Minimal, mobile-first dashboard using the core engine. Tabs for Dashboard,
          Invest, and Upgrades.
        </p>
      </header>

      {isDemo && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs text-amber-200">
          Demo mode — powered by Idle Engine
        </div>
      )}

      {!isDemo && (
        <div className="sm:hidden">
          {authSession ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300 shadow-sm">
              <p className="text-xs text-slate-400">
                Connected as {authSession.user.email ?? "unknown"}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-slate-100"
                  onClick={() => syncWithServer(authSession.access_token)}
                >
                  Sync now
                </button>
                {(syncStatus !== "idle" || lastSyncAt) && (
                  <span className="text-xs text-slate-400">
                    {lastSyncAt ? `Last Sync: ${formatTime(lastSyncAt)}` : ""}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300 shadow-sm">
              <div className="flex flex-col gap-3">
                <input
                  className="w-full rounded-full bg-white/10 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  placeholder="Email address"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  type="email"
                />
                <button
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={sendMagicLink}
                  disabled={authStatus === "sending" || authEmail.length === 0}
                >
                  {authStatus === "sending" ? "Sending..." : "Send magic link"}
                </button>
                {authStatus === "sent" && (
                  <span className="text-xs text-emerald-300">Check your inbox</span>
                )}
                {authStatus === "error" && (
                  <span className="text-xs text-amber-300">Login failed</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="lg:hidden">{renderPortfolioSplit()}</div>

      <div className="sticky top-0 z-20 mb-6 rounded-2xl border-b border-white/10 bg-slate-950/70 shadow-sm backdrop-blur-md sm:mb-0">
        <div className="grid items-stretch gap-3 sm:grid-cols-3">
          <div className="space-y-3 sm:hidden">
            <div className="grid w-full grid-cols-3 gap-2">
              {[
                { key: "cash", label: "Cash" },
                { key: "income", label: "Income" },
                { key: "netWorth", label: "Net Worth" },
              ].map((kpi) => (
                <button
                  key={kpi.key}
                  className={`w-full rounded-full px-2 py-1 text-xs font-semibold ${
                    mobileKpiTab === kpi.key
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                  onClick={() =>
                    setMobileKpiTab(kpi.key as "cash" | "income" | "netWorth")
                  }
                >
                  {kpi.label}
                </button>
              ))}
            </div>
            {mobileKpiTab === "cash" && (
              <KpiCard
                label="Cash"
                value={formatKpiMobileValue(state.cash)}
                subValue={formatCurrency(state.cash)}
                highlight={cashPulse}
              />
            )}
            {mobileKpiTab === "income" && (
              <KpiCard
                label="Income / min"
                value={formatKpiMobileValue((derived.incomePerSec || 0) * 60)}
                subValue={`${formatCurrency((derived.incomePerSec || 0) * 60)} / min`}
              />
            )}
            {mobileKpiTab === "netWorth" && (
              <KpiCard
                label="Net Worth"
                value={formatKpiMobileValue(derived.netWorth || 0)}
                subValue={formatCurrency(derived.netWorth || 0)}
                note={projectionCue(derived.incomePerSec || 0)}
              />
            )}
          </div>
          <KpiCard
            label="Cash"
            value={formatCompactCurrency(state.cash)}
            subValue={formatCurrency(state.cash)}
            highlight={cashPulse}
            className="hidden sm:block"
          />
          <KpiCard
            label="Income / min"
            value={formatCompactCurrency((derived.incomePerSec || 0) * 60)}
            subValue={`${formatCurrency((derived.incomePerSec || 0) * 60)} / min`}
            className="hidden sm:block"
          />
          <KpiCard
            label="Net Worth"
            value={formatCompactCurrency(derived.netWorth || 0)}
            subValue={formatCurrency(derived.netWorth || 0)}
            note={projectionCue(derived.incomePerSec || 0)}
            className="hidden sm:block"
          />
        </div>
      </div>

      <div
        className="hidden gap-3 sm:grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "bg-white/10 text-slate-200 hover:bg-white/15"
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="hidden sm:block sm:col-span-2">
            {renderPortfolioSplit()}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:col-span-2">
            <SmallCard
              label="Offline Cap"
              value={`${Math.round(state.modifiers.offlineCapSec / 3600)}h`}
            />
            <SmallCard
              label="Offline Multiplier"
              value={`${state.modifiers.offlineMultiplier.toFixed(2)}x`}
            />
          </div>

          {!isDemo && (
            <div className="grid grid-cols-2 gap-3 sm:hidden">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>Offline Boost</span>
                  <span className="rounded-full bg-emerald-400/15 p-2 text-emerald-200">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M13 3 4 14h7l-1 7 9-11h-7l1-7z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                <div className="mt-2">
                  <button
                    className="w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => startCheckout("offline_boost")}
                    disabled={checkoutLoadingType === "offline_boost"}
                  >
                    {checkoutLoadingType === "offline_boost"
                      ? "Redirecting..."
                      : "Boost"}
                  </button>
                  {activeEntitlements.offlineBoostActive && (
                    <span className="mt-2 block text-[10px] text-emerald-300">
                      Active: {formatDuration(activeEntitlements.offlineBoostRemainingMs)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  {offlineBoostDescription}
                </p>
              </div>

              {!activeEntitlements.vipActive && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>VIP Access</span>
                    <span className="rounded-full bg-amber-300/20 p-2 text-amber-200">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          d="M6.75 8.25 12 5.25l5.25 3-2 6.75h-6.5l-2-6.75z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 18h6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  <button
                    className="mt-2 w-full rounded-full bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => handleVipPlacementClick("dashboard")}
                    disabled={checkoutLoadingType === "vip"}
                  >
                    {checkoutLoadingType === "vip"
                      ? "Redirecting..."
                      : vipConfig.buttonLabel}
                  </button>
                  <p className="mt-2 text-xs text-slate-300">{vipConfig.tagline}</p>
                </div>
              )}

              {(activeEntitlements.vipActive || entitlements?.stripeCustomerId) && (
                <div className="rounded-2xl border border-white/10 bg-white/10 p-3 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>VIP Access</span>
                    <span className="rounded-full bg-amber-300/20 p-2 text-amber-200">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          d="M6.75 8.25 12 5.25l5.25 3-2 6.75h-6.5l-2-6.75z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 18h6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </div>
                  <button
                    className="mt-2 w-full rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                    onClick={startPortal}
                  >
                    Manage
                  </button>
                  <p className="mt-2 text-xs text-slate-300">
                    Manage VIP billing and perks.
                  </p>
                </div>
              )}
            </div>
          )}

          {!isDemo && (
            <>
              <div className="hidden rounded-2xl bg-white/10 p-4 shadow-sm sm:block">
                <p className="text-xs text-slate-400">Offline Boost</p>
                <p className="mt-2 text-sm text-slate-300">
                  {offlineBoostDescription}
                </p>
                {activeEntitlements.offlineBoostActive && (
                  <p className="mt-2 text-xs text-emerald-300">
                    Boost active: {formatDuration(activeEntitlements.offlineBoostRemainingMs)}
                  </p>
                )}
                  <button
                    className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => startCheckout("offline_boost")}
                    disabled={checkoutLoadingType === "offline_boost"}
                  >
                    {checkoutLoadingType === "offline_boost"
                      ? "Redirecting..."
                      : offlineBoostLabel}
                  </button>
                </div>
              {!activeEntitlements.vipActive && (
                <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 shadow-sm sm:block">
                  <p className="text-sm font-semibold text-slate-100">
                    {vipConfig.label}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {vipConfig.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-400">{vipConfig.tagline}</p>
                  <button
                    className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => handleVipPlacementClick("dashboard")}
                    disabled={checkoutLoadingType === "vip"}
                  >
                    {checkoutLoadingType === "vip"
                      ? "Redirecting..."
                      : vipConfig.buttonLabel}
                  </button>
                </div>
              )}
              {(activeEntitlements.vipActive || entitlements?.stripeCustomerId) && (
                <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 shadow-sm sm:block">
                  <p className="text-sm font-semibold text-slate-100">VIP Access</p>
                  <p className="mt-2 text-sm text-slate-300">
                    Manage your VIP subscription and billing details.
                  </p>
                  <button
                    className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                    onClick={startPortal}
                  >
                    {vipConfig.manageLabel}
                  </button>
                </div>
              )}
            </>
          )}
          {supabaseEnabled && !isDemo && (
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 shadow-sm sm:col-span-2 sm:block">
              {authSession ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400">
                    Connected as {authSession.user.email ?? "unknown"}
                  </span>
                  <button
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
                    onClick={() => syncWithServer(authSession.access_token)}
                  >
                    Sync now
                  </button>
                  {(syncStatus !== "idle" || lastSyncAt) && (
                    <span className="text-xs text-slate-400">
                      {lastSyncAt ? `Last Sync: ${formatTime(lastSyncAt)}` : ""}
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    className="w-full rounded-full bg-white/10 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                    placeholder="Email address"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    type="email"
                  />
                  <button
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={sendMagicLink}
                    disabled={authStatus === "sending" || authEmail.length === 0}
                  >
                    {authStatus === "sending" ? "Sending..." : "Send magic link"}
                  </button>
                  {authStatus === "sent" && (
                    <span className="text-xs text-emerald-300">Check your inbox</span>
                  )}
                  {authStatus === "error" && (
                    <span className="text-xs text-amber-300">Login failed</span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {tab === "invest" && (
        <section className="space-y-4">
          <div className="hidden lg:block">{renderPortfolioSplit()}</div>

          <div className="lg:hidden">
            {investCategoryView === "list" && (
              <div className="space-y-2">
                {assetsByCategory.map((category) => {
                  const income = categoryIncome.totals[category.id] ?? 0;
                  const total = categoryIncome.totalIncome || 0;
                  const percent = total > 0 ? (income / total) * 100 : 0;
                  const unlocked = isDemo || category.assets.some((asset) => {
                    const owned = state.assetsOwned[asset.id] ?? 0;
                    return owned > 0 || state.cash >= asset.unlockAtCash;
                  });
                  return (
                    <button
                      key={category.id}
                      className="group flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/15 active:bg-white/20"
                      onClick={() => {
                        setExpandedCategory(category.id);
                        setInvestCategoryView("detail");
                      }}
                    >
                      <span className="font-semibold">{category.label}</span>
                      <span className="text-slate-400 transition group-hover:text-slate-100">
                        <svg
                          className="h-4 w-4 transition-transform group-hover:translate-x-1"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            d="M9 6 15 12 9 18"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {investCategoryView === "detail" && (
              <div className="space-y-4">
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-slate-200"
                  onClick={() => setInvestCategoryView("list")}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M15 6 9 12l6 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Back to categories
                </button>
                {assetsByCategory
                  .filter((category) => category.id === expandedCategory)
                  .map((category) => {
                    const income = categoryIncome.totals[category.id] ?? 0;
                    const total = categoryIncome.totalIncome || 0;
                    const percent = total > 0 ? (income / total) * 100 : 0;
                    return (
                      <div key={category.id} className="space-y-4">
                        <div className="rounded-2xl bg-white/5 p-4 shadow-sm">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            Category
                          </p>
                          <p className="text-lg font-semibold text-slate-100">
                            {category.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {formatCurrency(income)} / sec ú {percent.toFixed(0)}%
                          </p>
                        </div>
                        <div className="grid gap-4">
                          {category.assets.map((asset) => assetCardById[asset.id])}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="hidden gap-4 lg:grid lg:grid-cols-[220px_1fr]">
            <aside className="space-y-2 rounded-2xl bg-white/5 p-3 shadow-sm">
              {assetsByCategory.map((category) => {
                const income = categoryIncome.totals[category.id] ?? 0;
                const total = categoryIncome.totalIncome || 0;
                const percent = total > 0 ? (income / total) * 100 : 0;
                const unlocked = isDemo || category.assets.some((asset) => {
                  const owned = state.assetsOwned[asset.id] ?? 0;
                  return owned > 0 || state.cash >= asset.unlockAtCash;
                });
                const isActive = expandedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    className={`flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left text-sm transition ${
                      isActive
                        ? "bg-white text-slate-900"
                        : "bg-white/5 text-slate-200 hover:bg-white/10"
                    }`}
                    onClick={() => setExpandedCategory(category.id)}
                  >
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {unlocked ? "Active" : "Locked"}
                    </span>
                    <span className="text-sm font-semibold">{category.label}</span>
                    <span className="text-xs text-slate-400">
                      {formatCurrency(income)} / sec ú {percent.toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </aside>

            <div className="space-y-4">
              {assetsByCategory
                .filter((category) => category.id === expandedCategory)
                .map((category) => {
                  const income = categoryIncome.totals[category.id] ?? 0;
                  const total = categoryIncome.totalIncome || 0;
                  const percent = total > 0 ? (income / total) * 100 : 0;
                  return (
                    <div key={category.id} className="space-y-4">
                      <div className="rounded-2xl bg-white/5 p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                              Category
                            </p>
                            <p className="text-lg font-semibold text-slate-100">
                              {category.label}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {formatCurrency(income)} / sec
                            </p>
                          </div>
                          <span className="text-xs text-slate-300">
                            {percent.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                          <div
                            className="h-1.5 rounded-full bg-emerald-400/60"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {category.assets.map((asset) => assetCardById[asset.id])}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {tab === "upgrades" && (
        <section className="space-y-4">
          <div className="lg:hidden">
            {upgradeCategoryView === "list" && (
              <div className="space-y-2">
                {upgradesByCategory.map((category) => (
                  <button
                    key={category.id}
                    className="group flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left text-sm text-slate-100 transition hover:bg-white/15 active:bg-white/20"
                    onClick={() => {
                      setExpandedUpgradeCategory(category.id);
                      setUpgradeCategoryView("detail");
                    }}
                  >
                    <span className="font-semibold">{category.label}</span>
                    <span className="text-xs text-slate-400 transition group-hover:text-slate-100">
                      {category.upgrades.length} upgrades
                    </span>
                  </button>
                ))}
              </div>
            )}
            {upgradeCategoryView === "detail" && (
              <div className="space-y-4">
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-slate-200"
                  onClick={() => setUpgradeCategoryView("list")}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M15 6 9 12l6 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Back to categories
                </button>
                {upgradesByCategory
                  .filter((category) => category.id === expandedUpgradeCategory)
                  .map((category) => (
                    <div key={category.id} className="space-y-4">
                      <div className="rounded-2xl bg-white/5 p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          Upgrades
                        </p>
                        <p className="text-lg font-semibold text-slate-100">
                          {category.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {category.upgrades.length} available
                        </p>
                      </div>
                      <div className="grid gap-4">
                        {category.upgrades.length > 0 ? (
                          category.upgrades.map((upgrade) => renderUpgradeCard(upgrade))
                        ) : (
                          <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300 shadow-sm">
                            Unlock upgrades by growing your cash.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="hidden gap-4 lg:grid lg:grid-cols-[220px_1fr]">
            <aside className="space-y-2 rounded-2xl bg-white/5 p-3 shadow-sm">
              {upgradesByCategory.map((category) => {
                const isActive = expandedUpgradeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    className={`flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left text-sm transition ${
                      isActive
                        ? "bg-white text-slate-900"
                        : "bg-white/5 text-slate-200 hover:bg-white/10"
                    }`}
                    onClick={() => setExpandedUpgradeCategory(category.id)}
                  >
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {category.upgrades.length > 0 ? "Active" : "Locked"}
                    </span>
                    <span className="text-sm font-semibold">{category.label}</span>
                    <span className="text-xs text-slate-400">
                      {category.upgrades.length} upgrades
                    </span>
                  </button>
                );
              })}
            </aside>

            <div className="space-y-4">
              {upgradesByCategory
                .filter((category) => category.id === expandedUpgradeCategory)
                .map((category) => (
                  <div key={category.id} className="space-y-4">
                    <div className="rounded-2xl bg-white/5 p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Upgrades
                      </p>
                      <p className="text-lg font-semibold text-slate-100">
                        {category.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {category.upgrades.length} available
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {category.upgrades.length > 0 ? (
                        category.upgrades.map((upgrade) => renderUpgradeCard(upgrade))
                      ) : (
                        <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300 shadow-sm">
                          Unlock upgrades by growing your cash.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {supabaseEnabled && tab === "leaderboard" && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300 shadow-sm">
            <p className="text-sm font-semibold text-slate-100">
              Global Net Worth Rankings
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Updated automatically from your current run.
            </p>
          </div>

          {!authSession && (
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300 shadow-sm">
              Sign in with Save & Sync to view the leaderboard.
            </div>
          )}

          {leaderboardStatus === "loading" && (
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300 shadow-sm">
              Loading leaderboard...
            </div>
          )}

          {leaderboardStatus === "error" && (
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300 shadow-sm">
              Failed to load leaderboard.
            </div>
          )}

          {leaderboardStatus === "idle" && authSession && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="text-slate-400">Allocation:</span>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    leaderboardAllocationMode === "income"
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                  onClick={() => setLeaderboardAllocationMode("income")}
                >
                  Income
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    leaderboardAllocationMode === "netWorth"
                      ? "bg-white text-slate-900"
                      : "bg-white/10 text-slate-200 hover:bg-white/15"
                  }`}
                  onClick={() => setLeaderboardAllocationMode("netWorth")}
                >
                  Net Worth
                </button>
              </div>
              {leaderboardTop.map((entry, index) => {
                const isCurrentUser = leaderboardMe?.rank === entry.rank;
                const portfolio = entry.portfolio ?? null;
                const allocation =
                  portfolio && leaderboardAllocationMode === "income"
                    ? portfolio.income
                    : portfolio && leaderboardAllocationMode === "netWorth"
                    ? portfolio.netWorth
                    : null;
                const segments =
                  allocation
                    ? [
                        {
                          id: "real_estate",
                          percent: allocation.realEstate * 100,
                        },
                        {
                          id: "financial_markets",
                          percent: allocation.markets * 100,
                        },
                        {
                          id: "businesses",
                          percent: allocation.business * 100,
                        },
                        {
                          id: "automation",
                          percent: allocation.automation * 100,
                        },
                      ]
                    : null;
                return (
                  <div
                    key={`${entry.rank}-${index}`}
                    className={`rounded-2xl p-3 text-sm ${
                      isCurrentUser
                        ? "bg-emerald-400/10 text-emerald-200"
                        : "bg-white/10 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          #{entry.rank}
                        </span>
                        <span className="font-semibold text-slate-100">
                          {entry.displayName ?? "Player"}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-100">
                        {leaderboardAllocationMode === "income" &&
                        entry.incomeValue != null
                          ? formatIncomeValue(
                              entry.incomeValue,
                              entry.incomeUnit ?? "per_min",
                            )
                          : formatCurrency(entry.netWorthValue ?? entry.value)}
                      </span>
                    </div>
                    {segments && (
                      <>
                        <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-white/10">
                          {segments.map((segment) => (
                            <div
                              key={segment.id}
                              className={`${allocationColors[segment.id]} flex items-center justify-center text-[10px] font-semibold text-slate-900`}
                              style={{
                                width: `${segment.percent}%`,
                                minWidth: segment.percent > 0 ? 2 : undefined,
                                flexShrink: 0,
                              }}
                            >
                              {segment.percent >= 12
                                ? `${segment.percent.toFixed(0)}%`
                                : ""}
                            </div>
                          ))}
                        </div>
                        {renderAllocationLegend(segments)}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {leaderboardMe && (
            <div className="rounded-2xl bg-emerald-400/10 p-4 text-sm text-emerald-200 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                  Your entry
                </p>
                <div className="relative">
                  <button
                    className="flex items-center gap-2 rounded-full bg-emerald-300/20 px-4 py-2 text-xs font-semibold text-emerald-100"
                    onClick={() => {
                      setShareMenuOpen((current) => !current);
                      trackEvent(ANALYTICS_EVENTS.SHARE_CLICKED, { action: "menu" });
                    }}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M15 8.25a3 3 0 1 0-2.82-4H12a3 3 0 0 0 0 6h.18A3 3 0 0 0 15 8.25z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9 12.75a3 3 0 1 0 0 6h.18A3 3 0 0 0 9 12.75z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15 15.75a3 3 0 1 0 0 6h.18A3 3 0 0 0 15 15.75z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12.9 9.6 8.1 13.4M12.9 14.4l-4.8 3.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Share
                  </button>
                  {shareMenuOpen && (
                    <div className="absolute right-0 mt-2 w-44 rounded-xl bg-slate-950/95 p-2 text-xs text-slate-100 shadow-lg">
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/10"
                        onClick={handleShareDownload}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            d="M12 4.5v10.5m0 0 3-3m-3 3-3-3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M4.5 19.5h15"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Download image
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/10"
                        onClick={() => handleShareExternal("x")}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            d="m4.5 4.5 15 15m0-15-15 15"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Share on X
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/10"
                        onClick={() => handleShareExternal("linkedin")}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            d="M6.75 9.75v7.5M6.75 6.75h.01M10.5 9.75v7.5m0-4.5a3 3 0 0 1 6 0v4.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Share on LinkedIn
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-lg font-semibold text-emerald-100">
                {leaderboardAllocationMode === "income" &&
                leaderboardMe.incomeValue != null
                  ? formatIncomeValue(
                      leaderboardMe.incomeValue,
                      leaderboardMe.incomeUnit ?? "per_min",
                    )
                  : leaderboardMe.value !== null
                    ? formatCurrency(leaderboardMe.value)
                    : "--"}
              </p>
              {leaderboardMe.rank && (
                <p className="mt-1 text-xs text-emerald-200">
                  Rank #{leaderboardMe.rank}
                </p>
              )}
              {selectedAllocationSegments && (
                <div className="mt-3 space-y-2">
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/10">
                    {selectedAllocationSegments.map((segment) => (
                      <div
                        key={segment.id}
                        className={`${allocationColors[segment.id]} flex items-center justify-center text-[10px] font-semibold text-slate-900`}
                        style={{
                          width: `${segment.percent}%`,
                          minWidth: segment.percent > 0 ? 2 : undefined,
                          flexShrink: 0,
                        }}
                      >
                        {segment.percent >= 12 ? `${segment.percent.toFixed(0)}%` : ""}
                      </div>
                    ))}
                  </div>
                  {renderAllocationLegend(selectedAllocationSegments)}
                  {mainAllocation && (
                    <p className="text-xs text-emerald-100">
                      Main source: {mainAllocation.label} (
                      {mainAllocation.percent.toFixed(0)}%)
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-slate-950/90 p-2 shadow-lg backdrop-blur sm:hidden">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                tab === t.key
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-slate-200 hover:bg-white/15"
              }`}
              onClick={() => setTab(t.key)}
            >
              {renderTabIcon(t.key)}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {offlineModal.open && (
        <div className="fixed right-4 top-4 z-50 w-full max-w-sm rounded-2xl bg-white/10 p-4 text-slate-100 shadow-lg backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Welcome back</p>
              <p className="mt-1 text-sm text-slate-300">
                While you were away, you earned {formatCurrency(offlineModal.earned)}
              </p>
              {!isDemo &&
                !activeEntitlements.vipActive &&
                vipPlacementVariant === "offline_modal" && (
                  <button
                    className="mt-3 rounded-full bg-amber-300 px-4 py-2 text-xs font-semibold text-slate-900"
                    onClick={() => handleVipPlacementClick("offline_modal")}
                  >
                    {vipConfig.buttonLabel}
                  </button>
                )}
            </div>
            <button
              className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/20"
              onClick={() => setOfflineModal({ open: false, earned: 0 })}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  subValue,
  note,
  highlight = false,
  className = "",
}: {
  label: string;
  value: string;
  subValue?: string;
  note?: string;
  highlight?: boolean;
  className?: string;
}) {
  const config = (() => {
    switch (label) {
      case "Cash":
        return {
          accent: "from-emerald-400/40 via-emerald-400/10 to-transparent",
          icon: (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M12 6.75v10.5m-4.5-8.25h6.75a2.25 2.25 0 0 1 0 4.5H9.75a2.25 2.25 0 0 0 0 4.5h6.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ),
          chip: "bg-emerald-400/15 text-emerald-200",
        };
      case "Income / min":
        return {
          accent: "from-sky-400/40 via-sky-400/10 to-transparent",
          icon: (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M4.5 15.75 9.75 10.5l3 3 6.75-7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.75 18.75h16.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ),
          chip: "bg-sky-400/15 text-sky-200",
        };
      case "Net Worth":
        return {
          accent: "from-violet-400/40 via-violet-400/10 to-transparent",
          icon: (
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M12 3.75 3.75 8.25 12 12.75l8.25-4.5L12 3.75z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.75 8.25v7.5L12 20.25l8.25-4.5v-7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ),
          chip: "bg-violet-400/15 text-violet-200",
        };
      default:
        return {
          accent: "from-white/20 via-white/5 to-transparent",
          icon: null,
          chip: "bg-white/10 text-slate-200",
        };
    }
  })();

  return (
    <div
      className={`relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 shadow-sm sm:p-4 ${className}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${config.accent}`}
      />
      <div className="relative flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">
          {label}
        </p>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${config.chip}`}
        >
          {config.icon}
        </span>
      </div>
      <p
        className={`mt-1 text-lg font-semibold leading-tight text-white transition-colors sm:mt-2 sm:text-3xl ${
          highlight ? "text-emerald-400" : ""
        }`}
      >
        {value}
      </p>
      {subValue && (
        <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">
          {subValue}
        </p>
      )}
      {note && (
        <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">
          {note}
        </p>
      )}
    </div>
  );
}

function SmallCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
