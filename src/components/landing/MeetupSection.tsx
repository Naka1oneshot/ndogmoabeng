import { Sparkles } from 'lucide-react';
import { useMeetupEvents } from '@/hooks/useMeetupEvents';
import { MeetupEventCard } from '@/components/meetup/MeetupEventCard';
import { Skeleton } from '@/components/ui/skeleton';

export function MeetupSection() {
  const { events, loading, error, refetch } = useMeetupEvents();

  if (loading) {
    return (
      <section id="meetups" className="py-16 px-4 bg-gradient-to-b from-background via-surface/30 to-background">
        <div className="container mx-auto max-w-4xl">
          <Skeleton className="h-10 w-64 mx-auto mb-8" />
          <Skeleton className="h-[500px] w-full rounded-2xl" />
        </div>
      </section>
    );
  }

  if (error || events.length === 0) {
    return null; // Don't show section if no events
  }

  return (
    <section id="meetups" className="py-16 px-4 bg-gradient-to-b from-background via-surface/30 to-background">
      <div className="container mx-auto max-w-4xl">
        {/* Section Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Événements</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Rencontres jeux
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Rejoins-nous pour des soirées stratégie, mystère et convivialité
          </p>
        </div>

        {/* Events Grid */}
        <div className="space-y-8">
          {events.map((event) => (
            <MeetupEventCard 
              key={event.id} 
              event={event} 
              onRegistrationSuccess={refetch}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
