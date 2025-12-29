import type { GameConfig } from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function validateGameConfig(
  input: unknown,
  fallback: GameConfig,
): GameConfig {
  if (!isRecord(input)) return fallback;
  const game = input.game;
  const branding = input.branding;
  const landing = input.landing;
  const economy = input.economy;
  const pricing = input.pricing;
  const demo = input.demo;

  if (!isRecord(game) || !isRecord(branding) || !isRecord(landing)) {
    return fallback;
  }
  if (!isRecord(economy) || !isRecord(pricing)) {
    return fallback;
  }

  const baseline = landing.baseline;
  const variantC = landing.variantC;
  if (!isRecord(baseline) || !isRecord(variantC)) {
    return fallback;
  }

  const vip = pricing.vip;
  const boosts = pricing.boosts;
  if (!isRecord(vip) || !Array.isArray(boosts)) {
    return fallback;
  }

  const valid =
    isString(game.name) &&
    isString(game.theme) &&
    isString(game.currency) &&
    isString(game.description) &&
    isString(branding.logoPath) &&
    isString(branding.primaryColor) &&
    isString(baseline.heroTitle) &&
    isString(baseline.heroSubtitle) &&
    isString(baseline.ctaLabel) &&
    isString(variantC.heroTitle) &&
    isString(variantC.heroSubtitle) &&
    isString(variantC.ctaLabel) &&
    isNumber(economy.baseIncome) &&
    isNumber(economy.growthRate) &&
    isNumber(economy.prestigeMultiplier) &&
    isNumber(economy.prestigeMinNetWorth) &&
    isNumber(economy.prestigeDivisor) &&
    isNumber(economy.prestigeExponent) &&
    isString(vip.label) &&
    isString(vip.tagline) &&
    isStringArray(vip.benefits) &&
    isString(vip.buttonLabel) &&
    isString(vip.manageLabel);

  if (!valid) return fallback;

  if (demo && isRecord(demo)) {
    if (
      (demo.incomeMultiplier !== undefined && !isNumber(demo.incomeMultiplier)) ||
      (demo.tickMultiplier !== undefined && !isNumber(demo.tickMultiplier)) ||
      (demo.startingCash !== undefined && !isNumber(demo.startingCash))
    ) {
      return fallback;
    }
  }

  for (const boost of boosts) {
    if (
      !isRecord(boost) ||
      !isString(boost.id) ||
      !isString(boost.label) ||
      !isNumber(boost.multiplier) ||
      !isNumber(boost.durationHours) ||
      !isString(boost.description)
    ) {
      return fallback;
    }
  }

  return input as GameConfig;
}
