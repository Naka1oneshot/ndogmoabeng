import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { SubscriptionStatus, SUBSCRIPTION_TIERS, SubscriptionTier } from '@/lib/subscriptionTiers';
import { toast } from 'sonner';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<SubscriptionStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle token payment callback - verify and add loyalty points
  useEffect(() => {
    const tokenStatus = searchParams.get('token');
    const sessionId = searchParams.get('session_id');
    
    if (tokenStatus === 'success' && sessionId) {
      // Clean URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('token');
      newParams.delete('session_id');
      setSearchParams(newParams, { replace: true });
      
      // Verify payment and add loyalty points
      supabase.functions.invoke('verify-token-payment', {
        body: { sessionId }
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error verifying token payment:', error);
          toast.error('Erreur lors de la vérification du paiement');
        } else if (data?.status === 'paid') {
          toast.success('Paiement confirmé ! Points de fidélité ajoutés 🎉');
        }
      });
    } else if (tokenStatus === 'cancelled') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('token');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  // Auto-refresh every 10 minutes instead of every minute (cost optimization)
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  // Expose a manual refresh for use after purchases/actions
  const refreshSubscription = useCallback(() => {
    return checkSubscription();
  }, [checkSubscription]);

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
    refreshSubscription, // Use this after purchases to force refresh
    createCheckout,
    createTokenPayment,
    openCustomerPortal,
    canCreateGame,
    hasClanBenefits,
    getRemainingTrialDays,
  };
}
