import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InviteStatus = 'paid' | 'confirmed_unpaid' | 'pending' | 'free' | 'declined' | 'not_invited_yet' | 'not_invited';

export interface EventInvite {
  id: string;
  meetup_event_id: string;
  full_name: string;
  email: string | null;
  address: string | null;
  phone: string | null;
  profiles: string | null;
  invite_status: InviteStatus;
  invited_by: string | null;
  pack_label: string | null;
  parking_amount: number;
  contributed_amount: number;
  followup_date: string | null;
  cash_box: string | null;
  notes: string | null;
  user_id: string | null;
  registration_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  registration?: {
    id: string;
    display_name: string;
    phone: string;
    payment_status: string;
    paid_amount_cents: number | null;
    paid_at: string | null;
  } | null;
  user_profile?: {
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export interface InviteStats {
  total: number;
  paid: number;
  paidOnline: number;
  paidCash: number;
  confirmedUnpaid: number;
  pending: number;
  free: number;
  declined: number;
  totalRevenue: number;
  totalParking: number;
  paidRevenue: number;
  projectedRevenue: number;
}

export function useEventInvites(eventId: string | null) {
  const [invites, setInvites] = useState<EventInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setInvites([]);
      return;
    }

    fetchInvites(eventId);

    const channel = supabase
      .channel(`invites-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_invites',
          filter: `meetup_event_id=eq.${eventId}`
        },
        () => fetchInvites(eventId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  async function fetchInvites(eid: string) {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('event_invites')
        .select(`
          *,
          registration:meetup_registrations(id, display_name, phone, payment_status, paid_amount_cents, paid_at)
        `)
        .eq('meetup_event_id', eid)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      // Fetch user profiles for linked users
      const invitesWithProfiles = await Promise.all(
        (data || []).map(async (invite) => {
          if (invite.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('user_id', invite.user_id)
              .single();
            
            return {
              ...invite,
              user_profile: profileData,
            };
          }
          return invite;
        })
      );
      
      setInvites(invitesWithProfiles as EventInvite[]);
    } catch (err) {
      console.error('Error fetching invites:', err);
      setError('Erreur lors du chargement des invités');
    } finally {
      setLoading(false);
    }
  }

  async function createInvite(invite: Partial<EventInvite>) {
    const { error } = await supabase
      .from('event_invites')
      .insert({
        ...invite,
        meetup_event_id: eventId!,
      } as any);
    
    if (error) throw error;
    if (eventId) await fetchInvites(eventId);
  }

  async function updateInvite(inviteId: string, updates: Partial<EventInvite>) {
    const { error } = await supabase
      .from('event_invites')
      .update(updates)
      .eq('id', inviteId);
    
    if (error) throw error;
    if (eventId) await fetchInvites(eventId);
  }

  async function deleteInvite(inviteId: string) {
    const { error } = await supabase
      .from('event_invites')
      .delete()
      .eq('id', inviteId);
    
    if (error) throw error;
    if (eventId) await fetchInvites(eventId);
  }

  async function markAsPaidCash(inviteId: string, amount: number) {
    await updateInvite(inviteId, {
      invite_status: 'paid',
      contributed_amount: amount,
    });
  }

  async function linkToUser(inviteId: string, userId: string) {
    await updateInvite(inviteId, { user_id: userId });
  }

  async function unlinkUser(inviteId: string) {
    await updateInvite(inviteId, { user_id: null } as any);
  }

  async function linkToRegistration(inviteId: string, registrationId: string) {
    await updateInvite(inviteId, { registration_id: registrationId });
  }

  const searchProfiles = useCallback(async (query: string): Promise<{ id: string; user_id: string; display_name: string; avatar_url: string | null; email?: string }[]> => {
    if (!query || query.length < 2) return [];
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, avatar_url')
      .or(`display_name.ilike.%${query}%`)
      .limit(10);
    
    if (error) {
      console.error('Error searching profiles:', error);
      return [];
    }
    
    return data || [];
  }, []);

  const searchUserByEmail = useCallback(async (email: string): Promise<{ user_id: string; display_name: string; avatar_url: string | null } | null> => {
    if (!email || !email.includes('@')) return null;
    
    try {
      const { data, error } = await supabase
        .rpc('admin_search_user_by_email', { search_email: email });
      
      if (error) {
        console.error('Error searching user by email:', error);
        return null;
      }
      
      if (data && data.length > 0) {
        return {
          user_id: data[0].user_id,
          display_name: data[0].display_name,
          avatar_url: data[0].avatar_url,
        };
      }
      return null;
    } catch (err) {
      console.error('Error in searchUserByEmail:', err);
      return null;
    }
  }, []);

  function getStats(): InviteStats {
    const paid = invites.filter(i => i.invite_status === 'paid');
    const paidOnline = paid.filter(i => i.registration?.payment_status === 'paid');
    const paidCash = paid.filter(i => !i.registration || i.registration.payment_status !== 'paid');
    const confirmedUnpaid = invites.filter(i => i.invite_status === 'confirmed_unpaid');
    const pending = invites.filter(i => i.invite_status === 'pending');
    
    // Only count paid, confirmed_unpaid, and pending for total and revenue
    const countedInvites = invites.filter(i => 
      i.invite_status === 'paid' || 
      i.invite_status === 'confirmed_unpaid' || 
      i.invite_status === 'pending'
    );

    // Revenue from paid guests only
    const paidRevenue = paid.reduce((sum, i) => sum + (i.contributed_amount || 0), 0);
    
    // Revenue from confirmed guests
    const confirmedRevenue = confirmedUnpaid.reduce((sum, i) => sum + (i.contributed_amount || 0), 0);
    
    // Revenue from pending guests (prorated at 50%)
    const pendingRevenueProrated = pending.reduce((sum, i) => sum + (i.contributed_amount || 0), 0) * 0.5;
    
    // Projected revenue = paid + confirmed + pending at 50%
    const projectedRevenue = paidRevenue + confirmedRevenue + pendingRevenueProrated;

    return {
      total: countedInvites.length,
      paid: paid.length,
      paidOnline: paidOnline.length,
      paidCash: paidCash.length,
      confirmedUnpaid: confirmedUnpaid.length,
      pending: pending.length,
      free: invites.filter(i => i.invite_status === 'free').length,
      declined: invites.filter(i => i.invite_status === 'declined').length,
      totalRevenue: countedInvites.reduce((sum, i) => sum + (i.contributed_amount || 0), 0),
      totalParking: invites.reduce((sum, i) => sum + (i.parking_amount || 0), 0),
      paidRevenue,
      projectedRevenue,
    };
  }

  function exportToCSV() {
    if (invites.length === 0) return;
    
    const headers = ['Nom', 'Email', 'Téléphone', 'Adresse', 'Statut', 'Pack', 'Montant', 'Parking', 'Notes', 'Invité par', 'Compte lié'];
    const rows = invites.map(i => [
      i.full_name,
      i.email || '',
      i.phone || '',
      (i.address || '').replace(/,/g, ';'),
      i.invite_status,
      i.pack_label || '',
      i.contributed_amount.toString(),
      i.parking_amount.toString(),
      (i.notes || '').replace(/,/g, ';'),
      i.invited_by || '',
      i.user_id ? 'Oui' : 'Non',
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invites-${eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return {
    invites,
    loading,
    error,
    createInvite,
    updateInvite,
    deleteInvite,
    markAsPaidCash,
    linkToUser,
    unlinkUser,
    linkToRegistration,
    searchProfiles,
    searchUserByEmail,
    getStats,
    exportToCSV,
    refetch: () => eventId && fetchInvites(eventId),
  };
}
