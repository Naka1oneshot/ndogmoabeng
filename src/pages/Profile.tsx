import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserAvatarButton } from '@/components/ui/UserAvatarButton';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  User, 
  Trophy, 
  Gamepad2, 
  Crown, 
  Calendar, 
  Edit2, 
  Save, 
  X,
  MapPin,
  Phone,
  Mail,
  Clock,
  Play,
  Users,
  Camera,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  DoorOpen
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FriendsSection } from '@/components/profile/FriendsSection';

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, stats, currentGames, loading, canChangeDisplayName, updateProfile, uploadAvatar, leaveGame, deleteGame } = useUserProfile();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    display_name: '',
    phone: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [gamesPage, setGamesPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const gamesPerPage = 5;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    console.log('startEditing called, profile:', profile);
    if (profile) {
      setEditForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        display_name: profile.display_name || '',
        phone: profile.phone || '',
        address: profile.address || '',
      });
      setIsEditing(true);
    } else {
      console.error('Cannot edit: profile is null');
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveChanges = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      display_name: editForm.display_name,
      phone: editForm.phone || null,
      address: editForm.address || null,
    });
    setSaving(false);
    if (!error) {
      setIsEditing(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    setUploadingAvatar(true);
    await uploadAvatar(file);
    setUploadingAvatar(false);
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return profile?.display_name?.[0]?.toUpperCase() || 'U';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Connexion requise</CardTitle>
            <CardDescription>
              Veuillez vous connecter pour accéder à votre profil
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/auth', { state: { from: location.pathname } })}>
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const winRate = stats && stats.games_played > 0 
    ? Math.round((stats.games_won / stats.games_played) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-background border-b">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="relative group">
                <Avatar
                  className="w-16 h-16 md:w-20 md:h-20 cursor-pointer border-2 border-primary/30 hover:border-primary transition-colors"
                  onClick={handleAvatarClick}
                >
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xl md:text-2xl font-bold">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <button
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-6 h-6 md:w-7 md:h-7 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 text-primary-foreground animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3 md:w-4 md:h-4 text-primary-foreground" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {profile?.display_name || 'Mon Profil'}
                </h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Accueil
              </Button>
              <UserAvatarButton size="sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{stats?.games_played || 0}</div>
              <div className="text-sm text-muted-foreground">Parties jouées</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold">{stats?.games_won || 0}</div>
              <div className="text-sm text-muted-foreground">Victoires</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">{stats?.games_created || 0}</div>
              <div className="text-sm text-muted-foreground">Parties créées</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-green-500 font-bold">{winRate}%</span>
              </div>
              <div className="text-2xl font-bold">{winRate}%</div>
              <div className="text-sm text-muted-foreground">Taux de victoire</div>
            </CardContent>
          </Card>
        </div>

        {/* Current Games */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Parties en cours
              </CardTitle>
              {currentGames.length > gamesPerPage && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setGamesPage(p => Math.max(1, p - 1))}
                    disabled={gamesPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[40px] text-center">
                    {gamesPage}/{Math.ceil(currentGames.length / gamesPerPage)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setGamesPage(p => Math.min(Math.ceil(currentGames.length / gamesPerPage), p + 1))}
                    disabled={gamesPage >= Math.ceil(currentGames.length / gamesPerPage)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentGames.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Aucune partie en cours
              </p>
            ) : (
              <div className="space-y-3">
                {currentGames
                  .slice((gamesPage - 1) * gamesPerPage, gamesPage * gamesPerPage)
                  .map((game) => (
                  <div 
                    key={game.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {game.is_host ? (
                        <Crown className="w-5 h-5 text-purple-500" />
                      ) : (
                        <Users className="w-5 h-5 text-primary" />
                      )}
                        <div>
                        <div className="font-medium">{game.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span>Code: {game.join_code}</span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {game.player_count} joueur{game.player_count > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Badge variant={game.is_host ? 'default' : 'secondary'}>
                        {game.is_host ? 'Hôte' : 'Joueur'}
                      </Badge>
                      <Badge variant="outline">{game.status}</Badge>
                      <Button 
                        size="sm" 
                        onClick={() => navigate(game.is_host ? `/mj/${game.id}` : `/play/${game.id}`)}
                      >
                        Rejoindre
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            disabled={actionLoading === game.id}
                          >
                            {actionLoading === game.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : game.is_host ? (
                              <Trash2 className="w-4 h-4" />
                            ) : (
                              <DoorOpen className="w-4 h-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {game.is_host ? 'Supprimer la partie ?' : 'Quitter la partie ?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {game.is_host 
                                ? 'Cette action est irréversible. Tous les joueurs seront déconnectés et les données de la partie seront supprimées.'
                                : 'Vous pourrez rejoindre à nouveau la partie plus tard avec le code d\'accès.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                setActionLoading(game.id);
                                if (game.is_host) {
                                  await deleteGame(game.id);
                                } else {
                                  await leaveGame(game.id);
                                }
                                setActionLoading(null);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {game.is_host ? 'Supprimer' : 'Quitter'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Friends Section */}
        <FriendsSection />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informations du profil
              </CardTitle>
              <CardDescription>
                Gérez vos informations personnelles
              </CardDescription>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Edit2 className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Prénom</Label>
                    <Input
                      id="first_name"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nom</Label>
                    <Input
                      id="last_name"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="display_name" className="flex items-center gap-2">
                    Pseudo
                    {!canChangeDisplayName && (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        Modifiable dans 1 mois
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="display_name"
                    value={editForm.display_name}
                    onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                    disabled={!canChangeDisplayName}
                  />
                  {!canChangeDisplayName && (
                    <p className="text-xs text-muted-foreground">
                      Vous ne pouvez modifier votre pseudo qu'une fois par mois
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone (optionnel)</Label>
                  <Input
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adresse (optionnel)</Label>
                  <Input
                    id="address"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="123 rue Example, 75000 Paris"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Nom complet</div>
                      <div className="font-medium">
                        {profile?.first_name} {profile?.last_name}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Pseudo</div>
                      <div className="font-medium">{profile?.display_name}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Téléphone</div>
                      <div className="font-medium">
                        {profile?.phone || 'Non renseigné'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Adresse</div>
                      <div className="font-medium">
                        {profile?.address || 'Non renseignée'}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Membre depuis</div>
                    <div className="font-medium">
                      {profile?.created_at 
                        ? format(new Date(profile.created_at), 'dd MMMM yyyy', { locale: fr })
                        : 'Inconnue'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
