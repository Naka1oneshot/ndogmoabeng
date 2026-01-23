import { useState } from 'react';
import { useEventInvites, InviteStatus, EventInvite } from '@/hooks/useEventInvites';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Download, Search, Edit2, Trash2, CreditCard, UserCheck, Link2 } from 'lucide-react';
import { MeetupEventAdmin } from '@/hooks/useAdminMeetups';

interface Props {
  eventId: string;
  event?: MeetupEventAdmin;
}

const STATUS_LABELS: Record<InviteStatus, string> = {
  paid: 'Payé',
  confirmed_unpaid: 'Confirmé (non payé)',
  pending: 'En attente',
  free: 'Invitation gratuite',
  declined: 'Refusé',
  not_invited_yet: 'Pas encore invité',
  not_invited: 'Non invité',
};

const STATUS_COLORS: Record<InviteStatus, string> = {
  paid: 'bg-green-500',
  confirmed_unpaid: 'bg-yellow-500',
  pending: 'bg-blue-500',
  free: 'bg-purple-500',
  declined: 'bg-red-500',
  not_invited_yet: 'bg-gray-400',
  not_invited: 'bg-gray-600',
};

export function EventInvitesTab({ eventId, event }: Props) {
  const {
    invites,
    loading,
    createInvite,
    updateInvite,
    deleteInvite,
    markAsPaidCash,
    getStats,
    exportToCSV,
  } = useEventInvites(eventId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingInvite, setEditingInvite] = useState<EventInvite | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<EventInvite>>({
    full_name: '',
    phone: '',
    address: '',
    invite_status: 'pending',
    pack_label: '',
    contributed_amount: 0,
    parking_amount: 0,
    notes: '',
    invited_by: '',
  });

  const stats = getStats();

  const filteredInvites = invites.filter(invite => {
    const matchesSearch = 
      invite.full_name.toLowerCase().includes(search.toLowerCase()) ||
      invite.phone?.toLowerCase().includes(search.toLowerCase()) ||
      invite.pack_label?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'paid_online' && invite.invite_status === 'paid' && invite.registration?.payment_status === 'paid') ||
      (statusFilter === 'paid_cash' && invite.invite_status === 'paid' && (!invite.registration || invite.registration.payment_status !== 'paid')) ||
      invite.invite_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSubmit = async () => {
    try {
      if (editingInvite) {
        await updateInvite(editingInvite.id, formData);
        toast.success('Invité mis à jour');
      } else {
        await createInvite(formData);
        toast.success('Invité ajouté');
      }
      setShowForm(false);
      setEditingInvite(null);
      resetForm();
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (invite: EventInvite) => {
    setEditingInvite(invite);
    setFormData({
      full_name: invite.full_name,
      phone: invite.phone || '',
      address: invite.address || '',
      invite_status: invite.invite_status,
      pack_label: invite.pack_label || '',
      contributed_amount: invite.contributed_amount,
      parking_amount: invite.parking_amount,
      notes: invite.notes || '',
      invited_by: invite.invited_by || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet invité ?')) return;
    try {
      await deleteInvite(id);
      toast.success('Invité supprimé');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleMarkPaid = async (invite: EventInvite) => {
    const amount = prompt('Montant payé (€):', invite.contributed_amount.toString());
    if (amount === null) return;
    try {
      await markAsPaidCash(invite.id, parseFloat(amount) || 0);
      toast.success('Marqué comme payé');
    } catch {
      toast.error('Erreur');
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: '',
      phone: '',
      address: '',
      invite_status: 'pending',
      pack_label: '',
      contributed_amount: 0,
      parking_amount: 0,
      notes: '',
      invited_by: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
            <div className="text-sm text-muted-foreground">Payés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.confirmedUnpaid}</div>
            <div className="text-sm text-muted-foreground">Confirmés</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">En attente</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.totalRevenue.toFixed(0)}€</div>
            <div className="text-sm text-muted-foreground">Revenus</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="paid">Payés (tous)</SelectItem>
                <SelectItem value="paid_online">Payés en ligne</SelectItem>
                <SelectItem value="paid_cash">Payés cash</SelectItem>
                <SelectItem value="confirmed_unpaid">Confirmés non payés</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="free">Gratuits</SelectItem>
                <SelectItem value="declined">Refusés</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => { resetForm(); setEditingInvite(null); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Pack</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredInvites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Aucun invité trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvites.map(invite => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">
                      {invite.full_name}
                      {invite.registration && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          <Link2 className="h-3 w-3 mr-1" />
                          Inscrit
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{invite.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[invite.invite_status]}>
                        {STATUS_LABELS[invite.invite_status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{invite.pack_label || '-'}</TableCell>
                    <TableCell className="text-right">
                      {invite.contributed_amount > 0 ? `${invite.contributed_amount}€` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(invite)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {invite.invite_status !== 'paid' && (
                          <Button size="icon" variant="ghost" onClick={() => handleMarkPaid(invite)}>
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        {invite.invite_status === 'pending' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => updateInvite(invite.id, { invite_status: 'confirmed_unpaid' })}
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(invite.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit/Create Sheet */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingInvite ? 'Modifier invité' : 'Nouvel invité'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Nom complet *</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input
                value={formData.phone || ''}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input
                value={formData.address || ''}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Statut</Label>
              <Select 
                value={formData.invite_status} 
                onValueChange={(v: InviteStatus) => setFormData({ ...formData, invite_status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pack</Label>
              <Input
                value={formData.pack_label || ''}
                onChange={e => setFormData({ ...formData, pack_label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Montant (€)</Label>
                <Input
                  type="number"
                  value={formData.contributed_amount || 0}
                  onChange={e => setFormData({ ...formData, contributed_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Parking (€)</Label>
                <Input
                  type="number"
                  value={formData.parking_amount || 0}
                  onChange={e => setFormData({ ...formData, parking_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label>Invité par</Label>
              <Input
                value={formData.invited_by || ''}
                onChange={e => setFormData({ ...formData, invited_by: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSubmit} className="flex-1">
                {editingInvite ? 'Mettre à jour' : 'Ajouter'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
