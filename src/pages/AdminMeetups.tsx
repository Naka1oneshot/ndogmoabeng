import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, Edit, Archive, Eye, Download, Copy, Loader2, Check, X, Crown, ChevronLeft, CreditCard, Phone, Banknote, Euro, Plus, TrendingUp, Percent, Building2, BarChart3, Copy as CopyIcon, Settings2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
import { ForestButton } from '@/components/ui/ForestButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Bar, BarChart } from 'recharts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminMeetups, useAdminRegistrations, MeetupEventAdmin } from '@/hooks/useAdminMeetups';
import { useMeetupStats } from '@/hooks/useMeetupStats';
import { toast } from 'sonner';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface NewEventForm {
  slug: string;
  title: string;
  description: string;
  city: string;
  venue: string;
  start_at: string;
  end_at: string;
  expected_players: number;
  price_eur: number;
  pot_contribution_eur: number;
  pot_potential_eur: number;
  audio_url: string;
  video_url: string;
  cover_image_url: string;
}

const initialNewEvent: NewEventForm = {
  slug: '',
  title: '',
  description: '',
  city: '',
  venue: '',
  start_at: '',
  end_at: '',
  expected_players: 20,
  price_eur: 10,
  pot_contribution_eur: 5,
  pot_potential_eur: 100,
  audio_url: '',
  video_url: '',
  cover_image_url: '',
};

export default function AdminMeetups() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdminOrSuper, loading: roleLoading } = useUserRole();
  const { events, loading: eventsLoading, archiveEvent, updateEvent, createEvent } = useAdminMeetups();
  const { stats, loading: statsLoading } = useMeetupStats();
  
  const [selectedEvent, setSelectedEvent] = useState<MeetupEventAdmin | null>(null);
  const [editingEvent, setEditingEvent] = useState<MeetupEventAdmin | null>(null);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEventForm>(initialNewEvent);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const { 
    registrations, 
    loading: regLoading, 
    updateRegistration,
    confirmCashPayment,
    exportToCSV,
    copyPhones
  } = useAdminRegistrations(selectedEvent?.id || null);

  // Auth check
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Veuillez vous connecter pour accéder à cette page</p>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/auth', { state: { from: location.pathname } })}>Se connecter</Button>
          <Button variant="outline" onClick={() => navigate('/')}>Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  if (!isAdminOrSuper) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">Accès réservé aux administrateurs</p>
        <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
      </div>
    );
  }

  const handleArchive = async (eventId: string) => {
    try {
      await archiveEvent(eventId);
      toast.success('Événement archivé');
    } catch {
      toast.error('Erreur lors de l\'archivage');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    try {
      await updateEvent(editingEvent.id, {
        title: editingEvent.title,
        description: editingEvent.description,
        city: editingEvent.city,
        venue: editingEvent.venue,
        expected_players: editingEvent.expected_players,
        price_eur: editingEvent.price_eur,
        pot_contribution_eur: editingEvent.pot_contribution_eur,
        pot_potential_eur: editingEvent.pot_potential_eur,
        video_url: editingEvent.video_url,
        audio_url: editingEvent.audio_url,
        cover_image_url: editingEvent.cover_image_url,
        status: editingEvent.status,
      });
      toast.success('Événement mis à jour');
      setShowEdit(false);
      setEditingEvent(null);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleStatusChange = async (regId: string, newStatus: string) => {
    try {
      await updateRegistration(regId, { status: newStatus });
      toast.success('Statut mis à jour');
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleConfirmCashPayment = async (regId: string, priceEur: number) => {
    try {
      await confirmCashPayment(regId, priceEur);
      toast.success('Paiement espèces confirmé');
    } catch {
      toast.error('Erreur lors de la confirmation');
    }
  };

  const handleNoteChange = async (regId: string, note: string) => {
    try {
      await updateRegistration(regId, { admin_note: note });
      toast.success('Note enregistrée');
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleCreateEvent = async () => {
    // Validation
    if (!newEvent.title || !newEvent.description || !newEvent.city || !newEvent.start_at || !newEvent.end_at || !newEvent.audio_url) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setCreatingEvent(true);
      await createEvent({
        slug: newEvent.slug || generateSlug(newEvent.title),
        title: newEvent.title,
        description: newEvent.description,
        city: newEvent.city,
        venue: newEvent.venue || undefined,
        start_at: newEvent.start_at,
        end_at: newEvent.end_at,
        expected_players: newEvent.expected_players,
        price_eur: newEvent.price_eur,
        pot_contribution_eur: newEvent.pot_contribution_eur,
        pot_potential_eur: newEvent.pot_potential_eur,
        audio_url: newEvent.audio_url,
        video_url: newEvent.video_url || undefined,
        cover_image_url: newEvent.cover_image_url || undefined,
      });
      toast.success('Événement créé avec succès');
      setShowCreate(false);
      setNewEvent(initialNewEvent);
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDuplicateEvent = (event: MeetupEventAdmin) => {
    // Pre-fill the create form with duplicated data
    setNewEvent({
      slug: '',
      title: `${event.title} (copie)`,
      description: event.description,
      city: event.city,
      venue: event.venue || '',
      start_at: '',
      end_at: '',
      expected_players: event.expected_players,
      price_eur: event.price_eur,
      pot_contribution_eur: event.pot_contribution_eur,
      pot_potential_eur: event.pot_potential_eur,
      audio_url: event.audio_url || '',
      video_url: event.video_url || '',
      cover_image_url: event.cover_image_url || '',
    });
    setShowCreate(true);
    toast.info('Événement dupliqué - modifiez les dates et le titre');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      UPCOMING: 'bg-accent/20 text-accent border-accent/30',
      FULL: 'bg-destructive/20 text-destructive border-destructive/30',
      ARCHIVED: 'bg-muted text-muted-foreground border-border',
      NEW: 'bg-primary/20 text-primary border-primary/30',
      CONTACTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      CONFIRMED: 'bg-green-500/20 text-green-400 border-green-500/30',
      CANCELLED: 'bg-destructive/20 text-destructive border-destructive/30',
      INTERESTED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    return (
      <Badge variant="outline" className={colors[status] || ''}>
        {status}
      </Badge>
    );
  };

  const getPaymentBadge = (paymentStatus: string, paidAmountCents: number | null) => {
    if (paymentStatus === 'paid') {
      return (
        <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <CreditCard className="w-3 h-3" />
          {paidAmountCents ? `${(paidAmountCents / 100).toFixed(0)}€` : 'Payé'}
        </Badge>
      );
    }
    if (paymentStatus === 'callback_requested') {
      return (
        <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
          <Phone className="w-3 h-3" />
          À rappeler
        </Badge>
      );
    }
    if (paymentStatus === 'pending') {
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1">
          <Euro className="w-3 h-3" />
          En attente
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ForestButton
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour</span>
            </ForestButton>
            <Link to="/">
              <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="h-8 w-8 object-contain" />
            </Link>
            <h1 className="font-display text-xl">Gestion Meetups</h1>
            <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30">
              <Crown className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserAvatarButton size="sm" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Stats Dashboard */}
        {statsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-surface border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Euro className="w-4 h-4" />
                    Revenus totaux
                  </div>
                  <p className="text-2xl font-bold text-accent">{stats.totalRevenue.toFixed(0)}€</p>
                </CardContent>
              </Card>
              
              <Card className="bg-surface border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Percent className="w-4 h-4" />
                    Taux de conversion
                  </div>
                  <p className="text-2xl font-bold text-primary">{stats.conversionRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalPaid} / {stats.totalRegistrations} inscrits
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-surface border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Phone className="w-4 h-4" />
                    À rappeler
                  </div>
                  <p className="text-2xl font-bold text-amber-400">{stats.pendingCallbacks}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-surface border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="w-4 h-4" />
                    Événements
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.upcomingEvents}</p>
                  <p className="text-xs text-muted-foreground">
                    +{stats.archivedEvents} archivés
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Revenue Chart */}
            <Card className="bg-surface border-border">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Évolution des revenus par mois
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.monthlyRevenue}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={{ stroke: 'hsl(var(--border))' }}
                        tickFormatter={(value) => `${value}€`}
                      />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--surface))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        formatter={(value: number) => [`${value.toFixed(0)}€`, 'Revenus']}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Events by City */}
            {stats.eventsByCity.length > 0 && (
              <Card className="bg-surface border-border">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Événements par ville
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {stats.eventsByCity.map(({ city, count }) => (
                      <Badge 
                        key={city} 
                        variant="outline" 
                        className="bg-primary/10 text-primary border-primary/30"
                      >
                        {city}: {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Events Table */}
        {eventsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="bg-surface border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Événements</CardTitle>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-primary hover:bg-primary-hover"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvel événement
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Titre</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Ville</TableHead>
                    <TableHead className="text-muted-foreground">Inscrits</TableHead>
                    <TableHead className="text-muted-foreground">Statut</TableHead>
                    <TableHead className="text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{event.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(event.start_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.city}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <span className="text-foreground">{event.registration_count}</span>
                          <span className="text-muted-foreground">/ {event.expected_players}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(event.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowRegistrations(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingEvent(event);
                              setShowEdit(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicateEvent(event)}
                            title="Dupliquer"
                          >
                            <CopyIcon className="w-4 h-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/admin/event-management', { state: { eventId: event.id } })}
                              >
                                <Settings2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Gestion avancée : Invités, Budget, PNL, Tâches</p>
                            </TooltipContent>
                          </Tooltip>
                          {event.status !== 'ARCHIVED' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleArchive(event.id)}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Registrations Sheet */}
      <Sheet open={showRegistrations} onOpenChange={setShowRegistrations}>
        <SheetContent className="w-full sm:max-w-2xl bg-surface border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">
              Inscriptions — {selectedEvent?.title}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="border-border"
              >
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  copyPhones();
                  toast.success('Téléphones copiés');
                }}
                className="border-border"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copier téléphones
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">
                Inscriptions: <span className="text-foreground font-medium">{registrations.length}</span>
              </span>
              <span className="text-muted-foreground">
                Total joueurs: <span className="text-primary font-medium">
                  {registrations.reduce((acc, r) => acc + 1 + (r.companions_count || 0), 0)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Payés: <span className="text-accent font-medium">
                  {registrations.filter(r => r.payment_status === 'paid').reduce((acc, r) => acc + 1 + (r.companions_count || 0), 0)}
                </span>
              </span>
              <span className="text-muted-foreground">
                À rappeler: <span className="text-amber-400 font-medium">
                  {registrations.filter(r => r.payment_status === 'callback_requested').length}
                </span>
              </span>
              <span className="text-muted-foreground">
                Confirmés: <span className="text-accent font-medium">
                  {registrations.filter(r => r.status === 'CONFIRMED').reduce((acc, r) => acc + 1 + (r.companions_count || 0), 0)}
                </span>
              </span>
            </div>

            {/* Table */}
            {regLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map((reg) => (
                  <Card key={reg.id} className="bg-surface-2 border-border">
                    <CardContent className="p-4 space-y-3">
                      {/* Header row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-foreground">{reg.display_name}</p>
                            <p className="text-sm text-muted-foreground">{reg.phone}</p>
                          </div>
                          {getPaymentBadge(reg.payment_status, reg.paid_amount_cents)}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Bouton confirmer espèces */}
                          {reg.payment_status !== 'paid' && selectedEvent && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-accent/50 text-accent hover:bg-accent/20"
                              onClick={() => handleConfirmCashPayment(reg.id, selectedEvent.price_eur * (1 + reg.companions_count))}
                            >
                              <Banknote className="w-3 h-3 mr-1" />
                              Espèces ({selectedEvent.price_eur * (1 + reg.companions_count)}€)
                            </Button>
                          )}
                          <Select
                            value={reg.status}
                            onValueChange={(value) => handleStatusChange(reg.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 bg-surface border-border text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-surface border-border">
                              <SelectItem value="NEW">NEW</SelectItem>
                              <SelectItem value="INTERESTED">INTERESTED</SelectItem>
                              <SelectItem value="CONTACTED">CONTACTED</SelectItem>
                              <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Companions */}
                      {reg.companions_count > 0 && (
                        <div className="p-2 rounded bg-accent/10 border border-accent/20">
                          <p className="text-sm text-accent font-medium flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            +{reg.companions_count} accompagnant{reg.companions_count > 1 ? 's' : ''}
                            <span className="text-muted-foreground font-normal">
                              (Total: {1 + reg.companions_count} joueurs)
                            </span>
                          </p>
                          {reg.companions_names && reg.companions_names.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {reg.companions_names.filter(n => n).join(', ')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* User note */}
                      {reg.user_note && (
                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                          <p className="text-xs text-blue-400 font-medium mb-1">💬 Note utilisateur:</p>
                          <p className="text-sm text-foreground">{reg.user_note}</p>
                        </div>
                      )}

                      {/* Admin note */}
                      <div className="pt-2 border-t border-border/50">
                        <Label className="text-xs text-muted-foreground">Note admin:</Label>
                        <Input
                          defaultValue={reg.admin_note || ''}
                          placeholder="Ajouter une note..."
                          className="mt-1 h-8 text-xs bg-surface border-border"
                          onBlur={(e) => {
                            if (e.target.value !== (reg.admin_note || '')) {
                              handleNoteChange(reg.id, e.target.value);
                            }
                          }}
                        />
                      </div>

                      {/* Date */}
                      <p className="text-xs text-muted-foreground">
                        Inscrit le {formatDate(reg.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Event Sheet */}
      <Sheet open={showEdit} onOpenChange={setShowEdit}>
        <SheetContent className="w-full sm:max-w-xl bg-surface border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">Modifier l'événement</SheetTitle>
          </SheetHeader>

          {editingEvent && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Titre</Label>
                <Input
                  value={editingEvent.title}
                  onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                  className="bg-surface-2 border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Description</Label>
                <Textarea
                  value={editingEvent.description}
                  onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                  className="bg-surface-2 border-border min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Ville</Label>
                  <Input
                    value={editingEvent.city}
                    onChange={(e) => setEditingEvent({ ...editingEvent, city: e.target.value })}
                    className="bg-surface-2 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Lieu</Label>
                  <Input
                    value={editingEvent.venue || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })}
                    className="bg-surface-2 border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Joueurs attendus</Label>
                  <Input
                    type="number"
                    value={editingEvent.expected_players}
                    onChange={(e) => setEditingEvent({ ...editingEvent, expected_players: parseInt(e.target.value) || 0 })}
                    className="bg-surface-2 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Prix (€)</Label>
                  <Input
                    type="number"
                    value={editingEvent.price_eur}
                    onChange={(e) => setEditingEvent({ ...editingEvent, price_eur: parseFloat(e.target.value) || 0 })}
                    className="bg-surface-2 border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Contribution cagnotte (€)</Label>
                  <Input
                    type="number"
                    value={editingEvent.pot_contribution_eur}
                    onChange={(e) => setEditingEvent({ ...editingEvent, pot_contribution_eur: parseFloat(e.target.value) || 0 })}
                    className="bg-surface-2 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Cagnotte potentielle (€)</Label>
                  <Input
                    type="number"
                    value={editingEvent.pot_potential_eur}
                    onChange={(e) => setEditingEvent({ ...editingEvent, pot_potential_eur: parseFloat(e.target.value) || 0 })}
                    className="bg-surface-2 border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">URL Vidéo</Label>
                <Input
                  value={editingEvent.video_url || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, video_url: e.target.value })}
                  className="bg-surface-2 border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">URL Audio</Label>
                <Input
                  value={editingEvent.audio_url || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, audio_url: e.target.value })}
                  className="bg-surface-2 border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">URL Image couverture</Label>
                <Input
                  value={editingEvent.cover_image_url || ''}
                  onChange={(e) => setEditingEvent({ ...editingEvent, cover_image_url: e.target.value })}
                  className="bg-surface-2 border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Statut</Label>
                <Select
                  value={editingEvent.status}
                  onValueChange={(value) => setEditingEvent({ ...editingEvent, status: value })}
                >
                  <SelectTrigger className="bg-surface-2 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    <SelectItem value="UPCOMING">UPCOMING</SelectItem>
                    <SelectItem value="FULL">FULL</SelectItem>
                    <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveEdit}
                  className="flex-1 bg-primary hover:bg-primary-hover"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEdit(false);
                    setEditingEvent(null);
                  }}
                  className="border-border"
                >
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Event Sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent className="w-full sm:max-w-xl bg-surface border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">Nouvel événement</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Titre *</Label>
              <Input
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value, slug: generateSlug(e.target.value) })}
                placeholder="Meetup Ndogmoabeng Paris"
                className="bg-surface-2 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Slug (URL)</Label>
              <Input
                value={newEvent.slug}
                onChange={(e) => setNewEvent({ ...newEvent, slug: e.target.value })}
                placeholder="meetup-ndogmoabeng-paris"
                className="bg-surface-2 border-border text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Description *</Label>
              <Textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Venez découvrir les jeux de société..."
                className="bg-surface-2 border-border min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Ville *</Label>
                <Input
                  value={newEvent.city}
                  onChange={(e) => setNewEvent({ ...newEvent, city: e.target.value })}
                  placeholder="Paris"
                  className="bg-surface-2 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Lieu</Label>
                <Input
                  value={newEvent.venue}
                  onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                  placeholder="Bar XYZ"
                  className="bg-surface-2 border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Date de début *</Label>
                <Input
                  type="datetime-local"
                  value={newEvent.start_at}
                  onChange={(e) => setNewEvent({ ...newEvent, start_at: e.target.value })}
                  className="bg-surface-2 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Date de fin *</Label>
                <Input
                  type="datetime-local"
                  value={newEvent.end_at}
                  onChange={(e) => setNewEvent({ ...newEvent, end_at: e.target.value })}
                  className="bg-surface-2 border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Joueurs attendus</Label>
                <Input
                  type="number"
                  value={newEvent.expected_players}
                  onChange={(e) => setNewEvent({ ...newEvent, expected_players: parseInt(e.target.value) || 20 })}
                  className="bg-surface-2 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Prix (€)</Label>
                <Input
                  type="number"
                  value={newEvent.price_eur}
                  onChange={(e) => setNewEvent({ ...newEvent, price_eur: parseFloat(e.target.value) || 0 })}
                  className="bg-surface-2 border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Contribution cagnotte (€)</Label>
                <Input
                  type="number"
                  value={newEvent.pot_contribution_eur}
                  onChange={(e) => setNewEvent({ ...newEvent, pot_contribution_eur: parseFloat(e.target.value) || 0 })}
                  className="bg-surface-2 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Cagnotte potentielle (€)</Label>
                <Input
                  type="number"
                  value={newEvent.pot_potential_eur}
                  onChange={(e) => setNewEvent({ ...newEvent, pot_potential_eur: parseFloat(e.target.value) || 0 })}
                  className="bg-surface-2 border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">URL Audio *</Label>
              <Input
                value={newEvent.audio_url}
                onChange={(e) => setNewEvent({ ...newEvent, audio_url: e.target.value })}
                placeholder="/media/meetup-audio.mp3"
                className="bg-surface-2 border-border"
              />
              <p className="text-xs text-muted-foreground">Obligatoire - ex: /media/meetup-audio.mp3</p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">URL Vidéo (optionnel)</Label>
              <Input
                value={newEvent.video_url}
                onChange={(e) => setNewEvent({ ...newEvent, video_url: e.target.value })}
                placeholder="/media/meetup-video.mp4"
                className="bg-surface-2 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">URL Image couverture (optionnel)</Label>
              <Input
                value={newEvent.cover_image_url}
                onChange={(e) => setNewEvent({ ...newEvent, cover_image_url: e.target.value })}
                placeholder="https://..."
                className="bg-surface-2 border-border"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateEvent}
                disabled={creatingEvent}
                className="flex-1 bg-primary hover:bg-primary-hover"
              >
                {creatingEvent ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Créer l'événement
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  setNewEvent(initialNewEvent);
                }}
                className="border-border"
              >
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
