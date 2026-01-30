import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getPublicBaseUrl } from '@/lib/urlHelpers';

export interface EarlyAccessRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useEarlyAccessRequests() {
  const [requests, setRequests] = useState<EarlyAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('early_access_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data as EarlyAccessRequest[] || []);
    } catch (err) {
      console.error('Error fetching early access requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const updateRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('early_access_requests')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: status === 'approved' ? 'Demande approuvée' : 'Demande rejetée',
        description: `La demande a été ${status === 'approved' ? 'approuvée' : 'rejetée'} avec succès.`,
      });

      await fetchRequests();
    } catch (err) {
      console.error('Error updating request:', err);
      toast({
        title: 'Erreur',
        description: "Une erreur s'est produite",
        variant: 'destructive',
      });
    }
  };

  const deleteRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('early_access_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Demande supprimée',
        description: 'La demande a été supprimée avec succès.',
      });

      await fetchRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
      toast({
        title: 'Erreur',
        description: "Une erreur s'est produite",
        variant: 'destructive',
      });
    }
  };

  const sendNotificationEmail = async (data: { full_name: string; email: string; phone?: string; message?: string }) => {
    try {
      const adminUrl = `${getPublicBaseUrl()}/admin?tab=system`;
      
      const { error } = await supabase.functions.invoke('notify-early-access-request', {
        body: {
          fullName: data.full_name,
          email: data.email,
          phone: data.phone || null,
          message: data.message || null,
          adminUrl,
        },
      });

      if (error) {
        console.error('Error sending notification email:', error);
      }
    } catch (err) {
      console.error('Error invoking notification function:', err);
    }
  };

  const submitRequest = async (data: { full_name: string; email: string; phone?: string; message?: string }) => {
    try {
      const { error } = await supabase
        .from('early_access_requests')
        .insert([data]);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Une demande avec cet email existe déjà.');
        }
        throw error;
      }

      // Send notification email to admin
      await sendNotificationEmail(data);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Une erreur s'est produite" };
    }
  };

  return {
    requests,
    loading,
    updateRequestStatus,
    deleteRequest,
    submitRequest,
    refetch: fetchRequests,
  };
}
