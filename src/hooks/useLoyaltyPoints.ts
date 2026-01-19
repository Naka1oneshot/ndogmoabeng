import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LoyaltyInfo {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export interface LoyaltyTransaction {
  id: string;
  amount: number;
  transaction_type: 'earned' | 'spent' | 'granted' | 'adjustment';
  source: string;
  note: string | null;
  created_at: string;
}

export function useLoyaltyPoints() {
  const { user } = useAuth();
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyInfo | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoyaltyInfo = useCallback(async () => {
    if (!user) {
      setLoyaltyInfo(null);
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch loyalty balance
      const { data: info, error: infoError } = await supabase
        .rpc('get_user_loyalty_info', { p_user_id: user.id });

      if (infoError) {
        console.error('Error fetching loyalty info:', infoError);
        setLoyaltyInfo({ balance: 0, total_earned: 0, total_spent: 0 });
      } else if (info && info.length > 0) {
        setLoyaltyInfo(info[0]);
      } else {
        setLoyaltyInfo({ balance: 0, total_earned: 0, total_spent: 0 });
      }

      // Fetch recent transactions
      const { data: txns, error: txnError } = await supabase
        .from('loyalty_transactions')
        .select('id, amount, transaction_type, source, note, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (txnError) {
        console.error('Error fetching transactions:', txnError);
      } else {
        setTransactions(txns as LoyaltyTransaction[] || []);
      }
    } catch (error) {
      console.error('Error in fetchLoyaltyInfo:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLoyaltyInfo();
  }, [fetchLoyaltyInfo]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('loyalty_points_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_points',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchLoyaltyInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchLoyaltyInfo]);

  return {
    loyaltyInfo,
    transactions,
    loading,
    refetch: fetchLoyaltyInfo,
  };
}
