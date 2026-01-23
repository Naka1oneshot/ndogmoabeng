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

      // For each event, get confirmed count from event_invites (paid + confirmed_unpaid)
      const eventsWithCounts = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { data: countData } = await supabase
            .rpc('get_event_confirmed_count', { p_event_id: event.id });
          
          return {
            ...event,
            registration_count: countData || 0,
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

export interface RegistrationData {
  displayName: string;
  phone: string;
  companionsCount: number;
  companionsNames: string[];
  userNote: string;
}

interface RegisterParams {
  eventId: string;
  data: RegistrationData;
  eventTitle: string;
  eventDate: string;
}

export function useMeetupRegistration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register({ eventId, data, eventTitle, eventDate }: RegisterParams) {
    try {
      setLoading(true);
      setError(null);

      // Check if already registered with same phone
      const { data: existing } = await supabase
        .from('meetup_registrations')
        .select('id, status')
        .eq('meetup_event_id', eventId)
        .eq('phone', data.phone)
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
          display_name: data.displayName,
          phone: data.phone,
          companions_count: data.companionsCount,
          companions_names: data.companionsNames.filter(n => n.trim() !== ''),
          user_note: data.userNote.trim() || null,
        });

      if (insertError) throw insertError;

      // Send notification email to admin (non-blocking)
      try {
        const adminUrl = `${window.location.origin}/admin/meetups`;
        await supabase.functions.invoke('notify-meetup-registration', {
          body: {
            eventTitle,
            eventDate,
            displayName: data.displayName,
            phone: data.phone,
            companionsCount: data.companionsCount,
            companionsNames: data.companionsNames.filter(n => n.trim() !== ''),
            userNote: data.userNote.trim() || null,
            adminUrl,
          },
        });
        console.log('Admin notification sent');
      } catch (notifError) {
        // Don't fail the registration if notification fails
        console.error('Failed to send admin notification:', notifError);
      }

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
