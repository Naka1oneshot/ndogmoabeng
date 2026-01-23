import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminMeetups } from '@/hooks/useAdminMeetups';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Wallet, FileSpreadsheet, ListTodo, Upload } from 'lucide-react';
import { EventInvitesTab } from '@/components/admin/EventInvitesTab';
import { EventBudgetTab } from '@/components/admin/EventBudgetTab';
import { EventPNLTab } from '@/components/admin/EventPNLTab';
import { EventTasksTab } from '@/components/admin/EventTasksTab';
import { EventImportTab } from '@/components/admin/EventImportTab';

export default function AdminEventManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { events, loading: eventsLoading } = useAdminMeetups();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('invites');

  // Get eventId from navigation state if passed
  const stateEventId = (location.state as { eventId?: string })?.eventId;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (!authLoading && !roleLoading && user && !isAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isAdmin, roleLoading, navigate]);

  useEffect(() => {
    // Priority: state eventId > first event
    if (stateEventId && events.some(e => e.id === stateEventId)) {
      setSelectedEventId(stateEventId);
    } else if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, stateEventId, selectedEventId]);

  if (authLoading || roleLoading || eventsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/meetups')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Gestion Événement</h1>
              <p className="text-sm text-muted-foreground">
                Invités, Budget, PNL & Tâches
              </p>
            </div>
            <Select value={selectedEventId || ''} onValueChange={setSelectedEventId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Sélectionner un événement" />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title} - {new Date(event.start_at).toLocaleDateString('fr-FR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!selectedEventId ? (
          <div className="text-center py-12 text-muted-foreground">
            Sélectionnez un événement pour commencer
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="invites" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Invités</span>
              </TabsTrigger>
              <TabsTrigger value="budget" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Budget</span>
              </TabsTrigger>
              <TabsTrigger value="pnl" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="hidden sm:inline">PNL</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                <span className="hidden sm:inline">Tâches</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invites">
              <EventInvitesTab eventId={selectedEventId} event={selectedEvent} />
            </TabsContent>
            <TabsContent value="budget">
              <EventBudgetTab eventId={selectedEventId} />
            </TabsContent>
            <TabsContent value="pnl">
              <EventPNLTab eventId={selectedEventId} />
            </TabsContent>
            <TabsContent value="tasks">
              <EventTasksTab eventId={selectedEventId} />
            </TabsContent>
            <TabsContent value="import">
              <EventImportTab eventId={selectedEventId} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
