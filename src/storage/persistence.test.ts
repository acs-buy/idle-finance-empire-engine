import { describe, expect, it } from "vitest";
import type { PlayerState } from "../game";
import { deserializePlayerState, serializePlayerState } from "./persistence";

const sampleState: PlayerState = {
  schemaVersion: 1,
  createdAt: 1_700_000_000_000,
  lastSeenAt: 1_700_000_100_000,
  cash: 123.45,
  assetsOwned: { savings_account: 2 },
  upgradesOwned: { upgrade_compound_basics: false },
  prestige: { pointsTotal: 0, lastResetAt: null },
  modifiers: { offlineCapSec: 28_800, offlineMultiplier: 1 },
  marketing: { utm: {}, referrer: "https://example.com", firstLandingAt: 1_700_000_000_000 },
  entitlements: {},
};

describe("persistence serialization", () => {
  it("round-trips PlayerState with schemaVersion", () => {
    const raw = serializePlayerState(sampleState);
    const parsed = deserializePlayerState(raw);
    expect(parsed).toEqual(sampleState);
  });

  it("rejects payload without schemaVersion", () => {
    const raw = JSON.stringify({ cash: 10 });
    const parsed = deserializePlayerState(raw);
    expect(parsed).toBeNull();
  });
});
