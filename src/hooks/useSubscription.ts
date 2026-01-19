import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { SubscriptionStatus, SUBSCRIPTION_TIERS, SubscriptionTier } from '@/lib/subscriptionTiers';

const DEFAULT_STATUS: SubscriptionStatus = {
  subscribed: false,
  tier: 'freemium',
  limits: SUBSCRIPTION_TIERS.freemium.features,
  max_limits: SUBSCRIPTION_TIERS.freemium.features,
  usage: { games_created: 0 },
  subscription_end: null,
  source: 'freemium',
  trial_active: false,
  trial_end: null,
  token_bonus: { token_balance: 0 },
};

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus(DEFAULT_STATUS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('check-subscription');
      
      if (fnError) {
        console.error('Error checking subscription:', fnError);
        setError(fnError.message);
        setStatus(DEFAULT_STATUS);
      } else if (data) {
        setStatus({
          subscribed: data.subscribed,
          tier: (data.tier as SubscriptionTier) || 'freemium',
          limits: data.limits || SUBSCRIPTION_TIERS.freemium.features,
          max_limits: data.max_limits || data.limits || SUBSCRIPTION_TIERS.freemium.features,
          usage: data.usage || { games_created: 0 },
          subscription_end: data.subscription_end,
          source: data.source || 'freemium',
          trial_active: data.trial_active || false,
          trial_end: data.trial_end || null,
          token_bonus: data.token_bonus || { token_balance: 0 },
        });
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(DEFAULT_STATUS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check subscription on mount and when user changes
  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every minute
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  const createCheckout = async (tier: 'starter' | 'premium' | 'royal') => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  };

  const createTokenPayment = async (quantity = 1) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-token-payment', {
        body: { quantity },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error creating token payment:', err);
      throw err;
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening customer portal:', err);
      throw err;
    }
  };

  // Helper to check if user can perform an action
  const canCreateGame = useCallback(() => {
    return status.limits.games_creatable > 0;
  }, [status.limits.games_creatable]);


  const hasClanBenefits = useCallback(() => {
    return status.limits.clan_benefits;
  }, [status.limits.clan_benefits]);

  const getRemainingTrialDays = useCallback(() => {
    if (!status.trial_active || !status.trial_end) return 0;
    const end = new Date(status.trial_end);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [status.trial_active, status.trial_end]);

  return {
    ...status,
    loading,
    error,
    checkSubscription,
    createCheckout,
    createTokenPayment,
    openCustomerPortal,
    canCreateGame,
    hasClanBenefits,
    getRemainingTrialDays,
  };
}
