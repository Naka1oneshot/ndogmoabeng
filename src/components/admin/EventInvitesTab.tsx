import { useState, useEffect, useCallback } from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Plus, Download, Search, Edit2, Trash2, CreditCard, UserCheck, Link2, User, X, Loader2 } from 'lucide-react';
import { MeetupEventAdmin } from '@/hooks/useAdminMeetups';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDebounce } from '@/hooks/useDebounce';

interface Props {
  eventId: string;
  event?: MeetupEventAdmin;
}

interface ProfileSearchResult {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
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
    linkToUser,
    unlinkUser,
    searchProfiles,
    searchUserByEmail,
    getStats,
    exportToCSV,
  } = useEventInvites(eventId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingInvite, setEditingInvite] = useState<EventInvite | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<EventInvite> & { linked_user_id?: string | null }>({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    invite_status: 'pending',
    pack_label: '',
    contributed_amount: 0,
    parking_amount: 0,
    notes: '',
    invited_by: '',
    linked_user_id: null,
  });

  // Profile search state
  const [profileSearch, setProfileSearch] = useState('');
  const [profileResults, setProfileResults] = useState<ProfileSearchResult[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileSearchResult | null>(null);
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);
  const [isSearchingByEmail, setIsSearchingByEmail] = useState(false);
  const [emailMatchFound, setEmailMatchFound] = useState(false);
  const debouncedProfileSearch = useDebounce(profileSearch, 300);
  const debouncedEmail = useDebounce(formData.email || '', 500);

  // Search profiles when query changes
  useEffect(() => {
    if (debouncedProfileSearch.length >= 2) {
      setIsSearchingProfiles(true);
      searchProfiles(debouncedProfileSearch).then(results => {
        setProfileResults(results);
        setIsSearchingProfiles(false);
      });
    } else {
      setProfileResults([]);
    }
  }, [debouncedProfileSearch, searchProfiles]);

  // Auto-search by email
  useEffect(() => {
    if (debouncedEmail && debouncedEmail.includes('@') && !selectedProfile) {
      setIsSearchingByEmail(true);
      searchUserByEmail(debouncedEmail).then(result => {
        if (result) {
          setSelectedProfile({
            id: '',
            user_id: result.user_id,
            display_name: result.display_name,
            avatar_url: result.avatar_url,
          });
          setEmailMatchFound(true);
        } else {
          setEmailMatchFound(false);
        }
        setIsSearchingByEmail(false);
      });
    } else {
      setEmailMatchFound(false);
    }
  }, [debouncedEmail, selectedProfile, searchUserByEmail]);

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
      const dataToSave = { ...formData };
      delete (dataToSave as any).linked_user_id; // Remove from main save

      if (editingInvite) {
        await updateInvite(editingInvite.id, dataToSave);
        
        // Handle user linking
        if (selectedProfile && selectedProfile.user_id !== editingInvite.user_id) {
          await linkToUser(editingInvite.id, selectedProfile.user_id);
        } else if (!selectedProfile && editingInvite.user_id) {
          await unlinkUser(editingInvite.id);
        }
        
        toast.success('Invité mis à jour');
      } else {
        await createInvite({
          ...dataToSave,
          user_id: selectedProfile?.user_id || null,
        });
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
      email: invite.email || '',
      phone: invite.phone || '',
      address: invite.address || '',
      invite_status: invite.invite_status,
      pack_label: invite.pack_label || '',
      contributed_amount: invite.contributed_amount,
      parking_amount: invite.parking_amount,
      notes: invite.notes || '',
      invited_by: invite.invited_by || '',
      linked_user_id: invite.user_id,
    });
    
    // If there's a linked user, set selectedProfile
    if (invite.user_profile) {
      setSelectedProfile({
        id: '',
        user_id: invite.user_id!,
        display_name: invite.user_profile.display_name,
        avatar_url: invite.user_profile.avatar_url,
      });
    } else {
      setSelectedProfile(null);
    }
    setProfileSearch('');
    setProfileResults([]);
    setEmailMatchFound(false);
    setShowForm(true);
  };

  const handleSelectProfile = (profile: ProfileSearchResult) => {
    setSelectedProfile(profile);
    setProfileSearch('');
    setProfileResults([]);
  };

  const handleClearProfile = () => {
    setSelectedProfile(null);
    setEmailMatchFound(false);
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
      email: '',
      phone: '',
      address: '',
      invite_status: 'pending',
      pack_label: '',
      contributed_amount: 0,
      parking_amount: 0,
      notes: '',
      invited_by: '',
      linked_user_id: null,
    });
    setSelectedProfile(null);
    setProfileSearch('');
    setProfileResults([]);
    setEmailMatchFound(false);
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
                <TableHead>Email</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredInvites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun invité trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvites.map(invite => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {invite.user_profile && (
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={invite.user_profile.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{invite.user_profile.display_name[0]}</AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          <div>{invite.full_name}</div>
                          {invite.user_profile && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {invite.user_profile.display_name}
                            </div>
                          )}
                        </div>
                      </div>
                      {invite.registration && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          <Link2 className="h-3 w-3 mr-1" />
                          Inscrit
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{invite.email || '-'}</TableCell>
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
                      <TooltipProvider delayDuration={300}>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => handleEdit(invite)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Modifier les informations de l'invité</p>
                            </TooltipContent>
                          </Tooltip>
                          {invite.invite_status !== 'paid' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => handleMarkPaid(invite)}>
                                  <CreditCard className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Marquer comme payé (espèces)</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {invite.invite_status === 'pending' && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => updateInvite(invite.id, { invite_status: 'confirmed_unpaid' })}
                                >
                                  <UserCheck className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Confirmer la présence (paiement sur place)</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(invite.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Supprimer l'invité</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
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
            {/* Profile linking section */}
            <div className="p-3 bg-muted/50 rounded-lg border">
              <Label className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                Lier à un profil utilisateur
              </Label>
              {selectedProfile ? (
                <div className="flex items-center gap-3 p-2 bg-background rounded-md border">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedProfile.avatar_url || undefined} />
                    <AvatarFallback>{selectedProfile.display_name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium">{selectedProfile.display_name}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={handleClearProfile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un pseudo..."
                    value={profileSearch}
                    onChange={e => setProfileSearch(e.target.value)}
                    className="pl-10"
                  />
                  {isSearchingProfiles && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {profileResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {profileResults.map(profile => (
                        <button
                          key={profile.id}
                          type="button"
                          className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left"
                          onClick={() => handleSelectProfile(profile)}
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={profile.avatar_url || undefined} />
                            <AvatarFallback>{profile.display_name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{profile.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Recherchez par pseudo pour lier cet invité à un compte utilisateur existant
              </p>
            </div>

            <div>
              <Label>Nom complet *</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                Email
                {isSearchingByEmail && <Loader2 className="h-3 w-3 animate-spin" />}
                {emailMatchFound && selectedProfile && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    ✓ Utilisateur trouvé
                  </Badge>
                )}
              </Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemple.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Si l'email correspond à un compte existant, l'invité sera automatiquement lié
              </p>
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
