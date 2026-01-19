import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MeetupEvent {
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
  status: 'UPCOMING' | 'FULL' | 'ARCHIVED';
  created_at: string;
  registration_count?: number;
}

export function useMeetupEvents() {
  const [events, setEvents] = useState<MeetupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      setLoading(true);
      
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('meetup_events')
        .select('*')
        .eq('status', 'UPCOMING')
        .order('start_at', { ascending: true });

      if (eventsError) throw eventsError;

      // For each event, get registration count
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
          } as MeetupEvent;
        })
      );

      setEvents(eventsWithCounts);
    } catch (err) {
      console.error('Error fetching meetup events:', err);
      setError('Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  }

  return { events, loading, error, refetch: fetchEvents };
}

export function useMeetupRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register(eventId: string, displayName: string, phone: string) {
    try {
      setLoading(true);
      setError(null);

      // Check if already registered with same phone
      const { data: existing } = await supabase
        .from('meetup_registrations')
        .select('id, status')
        .eq('meetup_event_id', eventId)
        .eq('phone', phone)
        .neq('status', 'CANCELLED')
        .maybeSingle();

      if (existing) {
        setError('Tu es déjà inscrit(e) à cet événement !');
        return false;
      }

      // Insert registration
      const { error: insertError } = await supabase
        .from('meetup_registrations')
        .insert({
          meetup_event_id: eventId,
          display_name: displayName,
          phone: phone,
        });

      if (insertError) throw insertError;

      return true;
    } catch (err) {
      console.error('Error registering:', err);
      setError('Erreur lors de l\'inscription');
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { register, loading, error, clearError: () => setError(null) };
}
