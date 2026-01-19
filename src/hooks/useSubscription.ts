import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { SubscriptionStatus, SUBSCRIPTION_TIERS } from '@/lib/subscriptionTiers';

const DEFAULT_STATUS: SubscriptionStatus = {
  subscribed: false,
  tier: 'freemium',
  limits: SUBSCRIPTION_TIERS.freemium.features,
  subscription_end: null,
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
          tier: data.tier || 'freemium',
          limits: data.limits || SUBSCRIPTION_TIERS.freemium.features,
          subscription_end: data.subscription_end,
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

  return {
    ...status,
    loading,
    error,
    checkSubscription,
    createCheckout,
    createTokenPayment,
    openCustomerPortal,
  };
}
