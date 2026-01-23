import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin, Users, Clock, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MeetupRegistration {
  id: string;
  display_name: string;
  phone: string;
  companions_count: number;
  companions_names: string[] | null;
  status: string;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
  meetup_event: {
    id: string;
    title: string;
    city: string;
    venue: string | null;
    start_at: string;
    end_at: string;
    status: string;
  } | null;
}

export function MyRegistrationsSection() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [registrations, setRegistrations] = useState<MeetupRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRegistrations = async () => {
      if (!user || !profile?.phone) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('meetup_registrations')
          .select(`
            id,
            display_name,
            phone,
            companions_count,
            companions_names,
            status,
            payment_status,
            paid_at,
            created_at,
            meetup_event:meetup_events (
              id,
              title,
              city,
              venue,
              start_at,
              end_at,
              status
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRegistrations((data as unknown as MeetupRegistration[]) || []);
      } catch (error) {
        console.error('Error fetching registrations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRegistrations();
  }, [user, profile?.phone]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Confirmé</Badge>;
      case 'CANCELLED':
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Annulé</Badge>;
      case 'NEW':
      default:
        return <Badge variant="secondary">Nouveau</Badge>;
    }
  };

  const getPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Payé</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">En attente</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Échoué</Badge>;
      default:
        return <Badge variant="secondary">{paymentStatus}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!profile?.phone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Mes inscriptions
          </CardTitle>
          <CardDescription>
            Ajoutez un numéro de téléphone à votre profil pour voir vos inscriptions aux événements.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Mes inscriptions
        </CardTitle>
        <CardDescription>
          Vos inscriptions aux événements Ndogmoabeng
        </CardDescription>
      </CardHeader>
      <CardContent>
        {registrations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Vous n'êtes inscrit à aucun événement</p>
          </div>
        ) : (
          <div className="space-y-4">
            {registrations.map((registration) => (
              <div
                key={registration.id}
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                {registration.meetup_event ? (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">
                          {registration.meetup_event.title}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {registration.meetup_event.city}
                            {registration.meetup_event.venue && ` - ${registration.meetup_event.venue}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {getStatusBadge(registration.status)}
                        {getPaymentBadge(registration.payment_status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>
                          {format(new Date(registration.meetup_event.start_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                        </span>
                      </div>
                      
                      {registration.companions_count > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>+{registration.companions_count} accompagnant{registration.companions_count > 1 ? 's' : ''}</span>
                        </div>
                      )}

                      {registration.paid_at && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CreditCard className="w-4 h-4" />
                          <span>
                            Payé le {format(new Date(registration.paid_at), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                        </div>
                      )}
                    </div>

                    {registration.companions_names && registration.companions_names.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Accompagnants:</span>{' '}
                          {registration.companions_names.join(', ')}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Événement non trouvé</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}