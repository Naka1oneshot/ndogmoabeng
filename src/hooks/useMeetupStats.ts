import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MeetupStats {
  totalRevenue: number;
  totalRegistrations: number;
  totalPaid: number;
  conversionRate: number;
  eventsByCity: { city: string; count: number }[];
  upcomingEvents: number;
  archivedEvents: number;
  pendingCallbacks: number;
}

interface RawRegistration {
  payment_status: string;
  paid_amount_cents: number | null;
  companions_count: number;
}

interface RawEvent {
  city: string;
  status: string;
}

export function useMeetupStats() {
  const [registrations, setRegistrations] = useState<RawRegistration[]>([]);
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const [regResult, eventsResult] = await Promise.all([
        supabase
          .from('meetup_registrations')
          .select('payment_status, paid_amount_cents, companions_count'),
        supabase
          .from('meetup_events')
          .select('city, status')
      ]);

      if (regResult.data) {
        setRegistrations(regResult.data);
      }
      if (eventsResult.data) {
        setEvents(eventsResult.data);
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
    // Total revenue (in euros)
    const totalRevenue = registrations
      .filter(r => r.payment_status === 'paid' && r.paid_amount_cents)
      .reduce((sum, r) => sum + (r.paid_amount_cents || 0), 0) / 100;

    // Total registrations (including companions)
    const totalRegistrations = registrations.reduce(
      (sum, r) => sum + 1 + (r.companions_count || 0),
      0
    );

    // Total paid (including companions)
    const totalPaid = registrations
      .filter(r => r.payment_status === 'paid')
      .reduce((sum, r) => sum + 1 + (r.companions_count || 0), 0);

    // Conversion rate
    const conversionRate = totalRegistrations > 0 
      ? (totalPaid / totalRegistrations) * 100 
      : 0;

    // Pending callbacks
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

    return {
      totalRevenue,
      totalRegistrations,
      totalPaid,
      conversionRate,
      eventsByCity,
      upcomingEvents,
      archivedEvents,
      pendingCallbacks,
    };
  }, [registrations, events]);

  return { stats, loading };
}
