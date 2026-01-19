// Subscription tiers configuration with Stripe product IDs
export const SUBSCRIPTION_TIERS = {
  freemium: {
    name: "Freemium",
    price: 0,
    price_id: null,
    product_id: null,
    features: {
      games_joinable: 10,
      games_creatable: 2,
      clan_benefits: false,
      max_friends: 2,
    },
  },
  starter: {
    name: "Starter",
    price: 1.99,
    price_id: "price_1SrPOJPyhxZzp6zs1Lqeeu7z",
    product_id: "prod_Tp3VRqayJwZs5D",
    features: {
      games_joinable: 30,
      games_creatable: 10,
      clan_benefits: true,
      max_friends: 10,
    },
  },
  premium: {
    name: "Premium",
    price: 3.99,
    price_id: "price_1SrPOmPyhxZzp6zsfnJap5Sh",
    product_id: "prod_Tp3VDl938PAQx0",
    features: {
      games_joinable: 100,
      games_creatable: 50,
      clan_benefits: true,
      max_friends: 20,
    },
  },
  royal: {
    name: "Royal",
    price: 6.99,
    price_id: "price_1SrPP8PyhxZzp6zs8OkvHM8y",
    product_id: "prod_Tp3W1ER13T1Qss",
    features: {
      games_joinable: -1, // unlimited
      games_creatable: 200,
      clan_benefits: true,
      max_friends: -1, // unlimited
    },
  },
} as const;

// Token Ndogmoabeng (one-time purchase)
export const TOKEN_NDOGMOABENG = {
  name: "Token Ndogmoabeng",
  price: 2,
  price_id: "price_1SrPPRPyhxZzp6zsoBe1jPHl",
  product_id: "prod_Tp3WOdPrY0clzC",
  features: {
    games_joinable: 30,
    games_creatable: 10,
  },
};

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

export interface SubscriptionLimits {
  games_joinable: number;
  games_creatable: number;
  clan_benefits: boolean;
  max_friends: number;
}

export interface SubscriptionStatus {
  subscribed: boolean;
  tier: SubscriptionTier;
  limits: SubscriptionLimits;
  subscription_end: string | null;
}
