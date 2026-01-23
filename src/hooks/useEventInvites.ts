import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type InviteStatus = 'paid' | 'confirmed_unpaid' | 'pending' | 'free' | 'declined' | 'not_invited_yet' | 'not_invited';

export interface EventInvite {
  id: string;
  meetup_event_id: string;
  full_name: string;
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
      setInvites((data || []) as EventInvite[]);
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

  async function linkToRegistration(inviteId: string, registrationId: string) {
    await updateInvite(inviteId, { registration_id: registrationId });
  }

  function getStats(): InviteStats {
    const paid = invites.filter(i => i.invite_status === 'paid');
    const paidOnline = paid.filter(i => i.registration?.payment_status === 'paid');
    const paidCash = paid.filter(i => !i.registration || i.registration.payment_status !== 'paid');

    return {
      total: invites.length,
      paid: paid.length,
      paidOnline: paidOnline.length,
      paidCash: paidCash.length,
      confirmedUnpaid: invites.filter(i => i.invite_status === 'confirmed_unpaid').length,
      pending: invites.filter(i => i.invite_status === 'pending').length,
      free: invites.filter(i => i.invite_status === 'free').length,
      declined: invites.filter(i => i.invite_status === 'declined').length,
      totalRevenue: invites.reduce((sum, i) => sum + (i.contributed_amount || 0), 0),
      totalParking: invites.reduce((sum, i) => sum + (i.parking_amount || 0), 0),
    };
  }

  function exportToCSV() {
    if (invites.length === 0) return;
    
    const headers = ['Nom', 'Téléphone', 'Adresse', 'Statut', 'Pack', 'Montant', 'Parking', 'Notes', 'Invité par'];
    const rows = invites.map(i => [
      i.full_name,
      i.phone || '',
      (i.address || '').replace(/,/g, ';'),
      i.invite_status,
      i.pack_label || '',
      i.contributed_amount.toString(),
      i.parking_amount.toString(),
      (i.notes || '').replace(/,/g, ';'),
      i.invited_by || '',
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
    linkToRegistration,
    getStats,
    exportToCSV,
    refetch: () => eventId && fetchInvites(eventId),
  };
}
