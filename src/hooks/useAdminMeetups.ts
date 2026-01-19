import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MeetupEventAdmin {
  id: string;
  slug: string;
  title: string;
  description: string;
  city: string;
  venue: string | null;
  start_at: string;
  end_at: string;
  expected_players: number;
  price_eur: number;
  pot_contribution_eur: number;
  pot_potential_eur: number;
  video_url: string | null;
  audio_url: string | null;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  registration_count: number;
}

export interface MeetupRegistration {
  id: string;
  meetup_event_id: string;
  display_name: string;
  phone: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

export function useAdminMeetups() {
  const [events, setEvents] = useState<MeetupEventAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('admin-meetups')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetup_registrations' },
        () => fetchEvents()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetup_events' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchEvents() {
    try {
      setLoading(true);
      
      const { data: eventsData, error: eventsError } = await supabase
        .from('meetup_events')
        .select('*')
        .order('start_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Get registration counts
      const eventsWithCounts = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { count } = await supabase
            .from('meetup_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('meetup_event_id', event.id)
            .neq('status', 'CANCELLED');
          
          return {
            ...event,
            registration_count: count || 0,
          } as MeetupEventAdmin;
        })
      );

      setEvents(eventsWithCounts);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  }

  async function updateEvent(eventId: string, updates: Partial<MeetupEventAdmin>) {
    const { error } = await supabase
      .from('meetup_events')
      .update(updates)
      .eq('id', eventId);
    
    if (error) throw error;
    await fetchEvents();
  }

  async function archiveEvent(eventId: string) {
    await updateEvent(eventId, { status: 'ARCHIVED' });
  }

  return { events, loading, error, refetch: fetchEvents, updateEvent, archiveEvent };
}

export function useAdminRegistrations(eventId: string | null) {
  const [registrations, setRegistrations] = useState<MeetupRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setRegistrations([]);
      return;
    }

    fetchRegistrations(eventId);

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`registrations-${eventId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'meetup_registrations',
          filter: `meetup_event_id=eq.${eventId}`
        },
        () => fetchRegistrations(eventId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  async function fetchRegistrations(eid: string) {
    try {
      setLoading(true);
      
      const { data, error: fetchError } = await supabase
        .from('meetup_registrations')
        .select('*')
        .eq('meetup_event_id', eid)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setRegistrations(data || []);
    } catch (err) {
      console.error('Error fetching registrations:', err);
      setError('Erreur lors du chargement des inscriptions');
    } finally {
      setLoading(false);
    }
  }

  async function updateRegistration(regId: string, updates: Partial<MeetupRegistration>) {
    const { error } = await supabase
      .from('meetup_registrations')
      .update(updates)
      .eq('id', regId);
    
    if (error) throw error;
    if (eventId) await fetchRegistrations(eventId);
  }

  async function deleteRegistration(regId: string) {
    const { error } = await supabase
      .from('meetup_registrations')
      .delete()
      .eq('id', regId);
    
    if (error) throw error;
    if (eventId) await fetchRegistrations(eventId);
  }

  function exportToCSV() {
    if (registrations.length === 0) return;
    
    const headers = ['Date', 'Nom', 'Téléphone', 'Statut', 'Note'];
    const rows = registrations.map(r => [
      new Date(r.created_at).toLocaleDateString('fr-FR'),
      r.display_name,
      r.phone,
      r.status,
      r.admin_note || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inscriptions-${eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function copyPhones() {
    const phones = registrations
      .filter(r => r.status !== 'CANCELLED')
      .map(r => r.phone)
      .join(', ');
    navigator.clipboard.writeText(phones);
  }

  return { 
    registrations, 
    loading, 
    error, 
    updateRegistration, 
    deleteRegistration,
    exportToCSV,
    copyPhones
  };
}
