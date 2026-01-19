// Subscription tiers configuration with Stripe product IDs
export const SUBSCRIPTION_TIERS = {
  freemium: {
    name: "Freemium",
    price: 0,
    price_id: null,
    product_id: null,
    features: {
      games_creatable: 2,
      clan_benefits: false,
      max_friends: 2,
      chat_access: "read_only" as const,
    },
    description: "Découvre l'univers de Ndogmoabeng",
  },
  starter: {
    name: "Starter",
    price: 1.99,
    price_id: "price_1SrPOJPyhxZzp6zs1Lqeeu7z",
    product_id: "prod_Tp3VRqayJwZs5D",
    features: {
      games_creatable: 10,
      clan_benefits: true,
      max_friends: 10,
      chat_access: "full" as const,
    },
    description: "Entre dans la communauté",
  },
  premium: {
    name: "Premium",
    price: 3.99,
    price_id: "price_1SrPOmPyhxZzp6zsfnJap5Sh",
    product_id: "prod_Tp3VDl938PAQx0",
    features: {
      games_creatable: 50,
      clan_benefits: true,
      max_friends: 20,
      chat_access: "full" as const,
    },
    description: "Joue sans contrainte, anime sans limite frustrante",
  },
  royal: {
    name: "Royal",
    price: 6.99,
    price_id: "price_1SrPP8PyhxZzp6zs8OkvHM8y",
    product_id: "prod_Tp3W1ER13T1Qss",
    features: {
      games_creatable: 200,
      clan_benefits: true,
      max_friends: -1, // unlimited
      chat_access: "full" as const,
    },
    description: "Deviens un pilier de Ndogmoabeng",
  },
} as const;

// Token Ndogmoabeng (one-time purchase)
export const TOKEN_NDOGMOABENG = {
  name: "Token Ndogmoabeng",
  price: 2,
  price_id: "price_1SrPPRPyhxZzp6zsoBe1jPHl",
  product_id: "prod_Tp3WOdPrY0clzC",
  features: {
    games_creatable: 10,
  },
  description: "Pack unique de parties animables supplémentaires",
};

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

export type ChatAccess = "read_only" | "full";

export interface SubscriptionLimits {
  games_creatable: number;
  clan_benefits: boolean;
  max_friends: number;
  chat_access: ChatAccess;
}

export function formatChatAccess(access: ChatAccess): string {
  return access === "read_only" ? "En lecture partout" : "Lecture et écriture partout";
}

export function formatGamesCreatable(value: number): string {
  if (value === -1) return "Illimité";
  return `${value} parties animables`;
}

export interface TokenBonus {
  games_creatable: number;
}

export interface UsageStats {
  games_created: number;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  max_limits?: SubscriptionLimits;
  usage?: UsageStats;
  subscription_end: string | null;
  source: "stripe" | "trial" | "freemium";
  trial_active: boolean;
  trial_end: string | null;
  token_bonus: TokenBonus;
}

export function formatLimitValue(value: number): string {
  return value === -1 ? "Illimité" : value.toString();
}

export function getTierDisplayName(tier: SubscriptionTier): string {
  return SUBSCRIPTION_TIERS[tier]?.name || "Freemium";
}

export function getTierColor(tier: SubscriptionTier): string {
  switch (tier) {
    case "royal":
      return "text-yellow-500";
    case "premium":
      return "text-purple-500";
    case "starter":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

export function getTierBadgeVariant(tier: SubscriptionTier): "default" | "secondary" | "destructive" | "outline" {
  switch (tier) {
    case "royal":
    case "premium":
      return "default";
    case "starter":
      return "secondary";
    default:
      return "outline";
  }
}
