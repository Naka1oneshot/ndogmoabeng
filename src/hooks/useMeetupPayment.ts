import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MeetupCheckoutParams {
  eventId: string;
  eventTitle: string;
  priceEur: number;
  displayName: string;
  phone: string;
  companionsCount: number;
  companionsNames: string[];
  userNote: string;
}

export function useMeetupPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCheckout = async (params: MeetupCheckoutParams): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('create-meetup-checkout', {
        body: params,
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Handle free events
      if (data?.free) {
        toast.success('🎉 Inscription confirmée !', {
          description: 'Tu es inscrit(e) à l\'événement.',
        });
        return true;
      }

      // Handle paid events - open Stripe checkout
      if (data?.url) {
        window.open(data.url, '_blank');
        return true;
      }

      throw new Error('No checkout URL returned');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la création du paiement';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (registrationId: string): Promise<'paid' | 'pending' | 'expired' | 'error'> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-meetup-payment', {
        body: { registrationId },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      return data?.status || 'pending';
    } catch (err) {
      console.error('Error verifying payment:', err);
      return 'error';
    }
  };

  return {
    createCheckout,
    verifyPayment,
    loading,
    error,
    clearError: () => setError(null),
  };
}

// Hook to check for payment success on page load
export function useMeetupPaymentCallback() {
  const [checking, setChecking] = useState(false);
  const { verifyPayment } = useMeetupPayment();

  useEffect(() => {
    const checkPaymentStatus = async () => {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('meetup_payment');
      const registrationId = params.get('registration_id');

      if (paymentStatus && registrationId) {
        setChecking(true);

        // Clean URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);

        if (paymentStatus === 'success') {
          // Verify payment with backend
          const status = await verifyPayment(registrationId);
          
          if (status === 'paid') {
            toast.success('🎉 Paiement confirmé ! Tu es inscrit(e) à l\'événement.', {
              duration: 6000,
            });
          } else if (status === 'pending') {
            toast.info('Paiement en cours de traitement...', {
              duration: 4000,
            });
          } else {
            toast.error('Le paiement n\'a pas pu être confirmé. Contacte-nous si tu as été débité.');
          }
        } else if (paymentStatus === 'cancelled') {
          toast.info('Paiement annulé. Tu peux réessayer quand tu veux !');
        }

        setChecking(false);
      }
    };

    checkPaymentStatus();
  }, []);

  return { checking };
}
