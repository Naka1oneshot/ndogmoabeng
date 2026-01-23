import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  registrations: number;
}

export interface MeetupStats {
  totalRevenue: number;
  totalRegistrations: number;
  totalPaid: number;
  conversionRate: number;
  eventsByCity: { city: string; count: number }[];
  upcomingEvents: number;
  archivedEvents: number;
  pendingCallbacks: number;
  monthlyRevenue: MonthlyRevenue[];
  linkedInvites: number;
  totalInvites: number;
}

interface RawRegistration {
  payment_status: string;
  paid_amount_cents: number | null;
  companions_count: number;
  paid_at: string | null;
}

interface RawEvent {
  city: string;
  status: string;
}

interface RawInvite {
  user_id: string | null;
  invite_status: string;
  contributed_amount: number | null;
}

export function useMeetupStats() {
  const [registrations, setRegistrations] = useState<RawRegistration[]>([]);
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [invites, setInvites] = useState<RawInvite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const [regResult, eventsResult, invitesResult] = await Promise.all([
        supabase
          .from('meetup_registrations')
          .select('payment_status, paid_amount_cents, companions_count, paid_at'),
        supabase
          .from('meetup_events')
          .select('city, status'),
        supabase
          .from('event_invites')
          .select('user_id, invite_status, contributed_amount')
      ]);

      if (regResult.data) {
        setRegistrations(regResult.data);
      }
      if (eventsResult.data) {
        setEvents(eventsResult.data);
      }
      if (invitesResult.data) {
        setInvites(invitesResult.data);
      }
      
      setLoading(false);
    }

    fetchData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('meetup-stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetup_registrations' },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetup_events' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo<MeetupStats>(() => {
    // Total revenue from paid invites (in euros)
    const totalRevenue = invites
      .filter(i => i.invite_status === 'paid' && i.contributed_amount)
      .reduce((sum, i) => sum + (i.contributed_amount || 0), 0);

    // Total confirmed participants (paid + confirmed_unpaid + free from invites)
    const totalRegistrations = invites.filter(
      i => ['paid', 'confirmed_unpaid', 'free'].includes(i.invite_status)
    ).length;

    // Total paid
    const totalPaid = invites.filter(i => i.invite_status === 'paid').length;

    // Conversion rate
    const conversionRate = totalRegistrations > 0 
      ? (totalPaid / totalRegistrations) * 100 
      : 0;

    // Pending callbacks (from registrations for backward compatibility)
    const pendingCallbacks = registrations.filter(
      r => r.payment_status === 'callback_requested'
    ).length;

    // Events by city
    const cityMap = new Map<string, number>();
    events.forEach(e => {
      cityMap.set(e.city, (cityMap.get(e.city) || 0) + 1);
    });
    const eventsByCity = Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);

    // Event counts by status
    const upcomingEvents = events.filter(e => e.status === 'UPCOMING').length;
    const archivedEvents = events.filter(e => e.status === 'ARCHIVED').length;

    // Monthly revenue calculation (last 12 months)
    const monthlyRevenueMap = new Map<string, { revenue: number; registrations: number }>();
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const monthDate = startOfMonth(subMonths(new Date(), i));
      const monthKey = format(monthDate, 'yyyy-MM');
      monthlyRevenueMap.set(monthKey, { revenue: 0, registrations: 0 });
    }

    // Fill with actual data
    registrations
      .filter(r => r.payment_status === 'paid' && r.paid_at)
      .forEach(r => {
        const monthKey = format(new Date(r.paid_at!), 'yyyy-MM');
        const existing = monthlyRevenueMap.get(monthKey);
        if (existing) {
          existing.revenue += (r.paid_amount_cents || 0) / 100;
          existing.registrations += 1 + (r.companions_count || 0);
        }
      });

    const monthlyRevenue: MonthlyRevenue[] = Array.from(monthlyRevenueMap.entries())
      .map(([monthKey, data]) => ({
        month: format(new Date(monthKey + '-01'), 'MMM yy', { locale: fr }),
        revenue: data.revenue,
        registrations: data.registrations,
      }));

    // Invites linked to user accounts
    const linkedInvites = invites.filter(i => i.user_id !== null).length;
    const totalInvites = invites.length;

    return {
      totalRevenue,
      totalRegistrations,
      totalPaid,
      conversionRate,
      eventsByCity,
      upcomingEvents,
      archivedEvents,
      pendingCallbacks,
      monthlyRevenue,
      linkedInvites,
      totalInvites,
    };
  }, [registrations, events, invites]);

  return { stats, loading };
}
