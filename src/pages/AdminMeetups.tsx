import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, Edit, Archive, Eye, Download, Copy, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminMeetups, useAdminRegistrations, MeetupEventAdmin } from '@/hooks/useAdminMeetups';
import { toast } from 'sonner';

export default function AdminMeetups() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { events, loading: eventsLoading, archiveEvent, updateEvent } = useAdminMeetups();
  
  const [selectedEvent, setSelectedEvent] = useState<MeetupEventAdmin | null>(null);
  const [editingEvent, setEditingEvent] = useState<MeetupEventAdmin | null>(null);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const { 
    registrations, 
    loading: regLoading, 
    updateRegistration,
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

  if (!user || !isAdmin) {
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

  const handleNoteChange = async (regId: string, note: string) => {
    try {
      await updateRegistration(regId, { admin_note: note });
      toast.success('Note enregistrée');
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    }
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
    };
    return (
      <Badge variant="outline" className={colors[status] || ''}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Admin — Rencontres jeux</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {eventsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Événements</CardTitle>
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
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                Total: <span className="text-foreground font-medium">{registrations.length}</span>
              </span>
              <span className="text-muted-foreground">
                Confirmés: <span className="text-green-400 font-medium">
                  {registrations.filter(r => r.status === 'CONFIRMED').length}
                </span>
              </span>
            </div>

            {/* Table */}
            {regLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Nom</TableHead>
                    <TableHead className="text-muted-foreground">Téléphone</TableHead>
                    <TableHead className="text-muted-foreground">Statut</TableHead>
                    <TableHead className="text-muted-foreground">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((reg) => (
                    <TableRow key={reg.id} className="border-border">
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(reg.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {reg.display_name}
                      </TableCell>
                      <TableCell className="text-foreground">{reg.phone}</TableCell>
                      <TableCell>
                        <Select
                          value={reg.status}
                          onValueChange={(value) => handleStatusChange(reg.id, value)}
                        >
                          <SelectTrigger className="w-28 h-8 bg-surface-2 border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-surface border-border">
                            <SelectItem value="NEW">NEW</SelectItem>
                            <SelectItem value="CONTACTED">CONTACTED</SelectItem>
                            <SelectItem value="CONFIRMED">CONFIRMED</SelectItem>
                            <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={reg.admin_note || ''}
                          placeholder="Note..."
                          className="h-8 text-xs bg-surface-2 border-border"
                          onBlur={(e) => {
                            if (e.target.value !== (reg.admin_note || '')) {
                              handleNoteChange(reg.id, e.target.value);
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
    </div>
  );
}
