export type LandingVariantCopy = {
  heroTitle: string;
  heroSubtitle: string;
  ctaLabel: string;
};

export type GameConfig = {
  game: {
    name: string;
    theme: string;
    currency: string;
    description: string;
  };
  branding: {
    logoPath: string;
    primaryColor: string;
  };
  landing: {
    baseline: LandingVariantCopy;
    variantC: LandingVariantCopy;
  };
  economy: {
    baseIncome: number;
    growthRate: number;
    prestigeMultiplier: number;
    prestigeMinNetWorth: number;
    prestigeDivisor: number;
    prestigeExponent: number;
  };
  pricing: {
    vip: {
      label: string;
      tagline: string;
      benefits: string[];
      buttonLabel: string;
      manageLabel: string;
    };
    boosts: Array<{
      id: string;
      label: string;
      multiplier: number;
      durationHours: number;
      description: string;
    }>;
  };
  demo?: {
    incomeMultiplier?: number;
    tickMultiplier?: number;
    startingCash?: number;
  };
};
