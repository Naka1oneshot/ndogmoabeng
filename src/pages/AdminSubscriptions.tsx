import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
  Shield, 
  Zap, 
  Search, 
  Gift,
  Loader2,
  ChevronLeft,
  User,
  Clock,
  Star,
  Crown,
  UserCheck,
  UserX,
  ShieldAlert,
  ShieldCheck,
  History
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserBonus {
  user_id: string;
  display_name: string;
  token_balance: number;
  trial_tier: string;
  trial_end_at: string;
  updated_at: string;
}

interface LoyaltyUser {
  user_id: string;
  display_name: string;
  balance: number;
  total_earned: number;
  updated_at: string;
}

interface UserWithRole {
  user_id: string;
  display_name: string;
  email: string;
  role: 'super_admin' | 'admin' | null;
  created_at: string;
}

interface AuditLogEntry {
  id: string;
  performed_by_email: string;
  target_user_email: string;
  action: string;
  details: { 
    display_name?: string;
    tokens_count?: number;
    points_count?: number;
    note?: string;
    previous_balance?: number;
    new_balance?: number;
  } | null;
  created_at: string;
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdminOrSuper, isSuperAdmin, loading: roleLoading } = useUserRole();
  
  // Tokens state
  const [searchTerm, setSearchTerm] = useState('');
  const [targetDisplayName, setTargetDisplayName] = useState('');
  const [tokensToGrant, setTokensToGrant] = useState(10);
  const [grantLoading, setGrantLoading] = useState(false);
  const [recentBonuses, setRecentBonuses] = useState<UserBonus[]>([]);
  const [loadingBonuses, setLoadingBonuses] = useState(true);

  // Loyalty state
  const [loyaltySearchTerm, setLoyaltySearchTerm] = useState('');
  const [loyaltyTargetDisplayName, setLoyaltyTargetDisplayName] = useState('');
  const [pointsToGrant, setPointsToGrant] = useState(10);
  const [loyaltyNote, setLoyaltyNote] = useState('');
  const [loyaltyGrantLoading, setLoyaltyGrantLoading] = useState(false);
  const [recentLoyaltyUsers, setRecentLoyaltyUsers] = useState<LoyaltyUser[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(true);

  // Roles state (super_admin only)
  const [rolesSearchTerm, setRolesSearchTerm] = useState('');
  const [usersWithRoles, setUsersWithRoles] = useState<UserWithRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [promoteDisplayName, setPromoteDisplayName] = useState('');
  const [promotingUser, setPromotingUser] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  
  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loadingAuditLog, setLoadingAuditLog] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { state: { from: location.pathname } });
    }
  }, [user, authLoading, navigate, location.pathname]);

  useEffect(() => {
    if (!roleLoading && !isAdminOrSuper) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits administrateur",
        variant: "destructive",
      });
      navigate('/profile');
    }
  }, [isAdminOrSuper, roleLoading, navigate]);

  useEffect(() => {
    if (isAdminOrSuper) {
      fetchRecentBonuses();
      fetchRecentLoyaltyUsers();
    }
    if (isSuperAdmin) {
      fetchUsersWithRoles();
      fetchAuditLog();
    }
  }, [isAdminOrSuper, isSuperAdmin]);

  const fetchAuditLog = async () => {
    setLoadingAuditLog(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('id, performed_by_email, target_user_email, action, details, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAuditLog((data as AuditLogEntry[]) || []);
    } catch (error) {
      console.error('Error fetching audit log:', error);
    } finally {
      setLoadingAuditLog(false);
    }
  };

  const fetchRecentBonuses = async () => {
    setLoadingBonuses(true);
    try {
      const { data: bonuses, error } = await supabase
        .from('user_subscription_bonuses')
        .select('user_id, token_balance, trial_tier, trial_end_at, updated_at')
        .gt('token_balance', 0)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (bonuses && bonuses.length > 0) {
        const userIds = bonuses.map(b => b.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        setRecentBonuses(bonuses.map(b => ({
          ...b,
          display_name: profileMap.get(b.user_id) || 'Inconnu',
        })));
      } else {
        setRecentBonuses([]);
      }
    } catch (error) {
      console.error('Error fetching bonuses:', error);
    } finally {
      setLoadingBonuses(false);
    }
  };

  const fetchRecentLoyaltyUsers = async () => {
    setLoadingLoyalty(true);
    try {
      const { data: loyaltyData, error } = await supabase
        .from('loyalty_points')
        .select('user_id, balance, total_earned, updated_at')
        .gt('total_earned', 0)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (loyaltyData && loyaltyData.length > 0) {
        const userIds = loyaltyData.map(l => l.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        setRecentLoyaltyUsers(loyaltyData.map(l => ({
          ...l,
          display_name: profileMap.get(l.user_id) || 'Inconnu',
        })));
      } else {
        setRecentLoyaltyUsers([]);
      }
    } catch (error) {
      console.error('Error fetching loyalty users:', error);
    } finally {
      setLoadingLoyalty(false);
    }
  };

  const fetchUsersWithRoles = async () => {
    setLoadingRoles(true);
    try {
      // Get all user_roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        
        // Fetch profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
        
        // Fetch emails via RPC (admin only)
        const usersWithEmails: UserWithRole[] = await Promise.all(
          roles.map(async (r) => {
            const { data: email } = await supabase.rpc('get_user_email', { user_id: r.user_id });
            return {
              user_id: r.user_id,
              display_name: profileMap.get(r.user_id) || 'Inconnu',
              email: email || 'N/A',
              role: r.role as 'super_admin' | 'admin',
              created_at: r.created_at,
            };
          })
        );

        setUsersWithRoles(usersWithEmails);
      } else {
        setUsersWithRoles([]);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleGrantTokens = async () => {
    if (!targetDisplayName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un pseudo",
        variant: "destructive",
      });
      return;
    }

    if (tokensToGrant <= 0) {
      toast({
        title: "Erreur",
        description: "Le nombre de tokens doit être supérieur à 0",
        variant: "destructive",
      });
      return;
    }

    setGrantLoading(true);
    try {
      const response = await supabase.functions.invoke('admin-grant-tokens', {
        body: {
          display_name: targetDisplayName.trim(),
          tokens_count: tokensToGrant,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      toast({
        title: "Tokens octroyés",
        description: `${result.added_tokens} tokens ajoutés à ${result.target_user}. Nouveau total: ${result.new_total}`,
      });

      setTargetDisplayName('');
      setTokensToGrant(10);
      fetchRecentBonuses();
    } catch (error) {
      console.error('Error granting tokens:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'octroyer les tokens",
        variant: "destructive",
      });
    } finally {
      setGrantLoading(false);
    }
  };

  const handleGrantLoyaltyPoints = async () => {
    if (!loyaltyTargetDisplayName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un pseudo",
        variant: "destructive",
      });
      return;
    }

    if (pointsToGrant <= 0) {
      toast({
        title: "Erreur",
        description: "Le nombre de points doit être supérieur à 0",
        variant: "destructive",
      });
      return;
    }

    if (!loyaltyNote.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer une note explicative",
        variant: "destructive",
      });
      return;
    }

    setLoyaltyGrantLoading(true);
    try {
      const response = await supabase.functions.invoke('admin-grant-loyalty-points', {
        body: {
          display_name: loyaltyTargetDisplayName.trim(),
          points_count: pointsToGrant,
          note: loyaltyNote.trim(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      toast({
        title: "Points octroyés",
        description: `${result.added_points} points ajoutés à ${result.target_user}. Nouveau solde: ${result.new_balance}`,
      });

      setLoyaltyTargetDisplayName('');
      setPointsToGrant(10);
      setLoyaltyNote('');
      fetchRecentLoyaltyUsers();
    } catch (error) {
      console.error('Error granting loyalty points:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'octroyer les points",
        variant: "destructive",
      });
    } finally {
      setLoyaltyGrantLoading(false);
    }
  };

  const handlePromoteToAdmin = async () => {
    if (!promoteDisplayName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un pseudo",
        variant: "destructive",
      });
      return;
    }

    setPromotingUser(true);
    try {
      const response = await supabase.functions.invoke('manage-user-role', {
        body: {
          display_name: promoteDisplayName.trim(),
          action: 'promote',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;

      toast({
        title: "Utilisateur promu",
        description: `${result.display_name} est maintenant administrateur`,
      });

      setPromoteDisplayName('');
      fetchUsersWithRoles();
      fetchAuditLog();
    } catch (error) {
      console.error('Error promoting user:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de promouvoir l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setPromotingUser(false);
    }
  };

  const handleRevokeAdmin = async (userId: string, displayName: string) => {
    setRevokingUserId(userId);
    try {
      const response = await supabase.functions.invoke('manage-user-role', {
        body: {
          user_id: userId,
          action: 'revoke',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Rôle révoqué",
        description: `${displayName} n'est plus administrateur`,
      });

      fetchUsersWithRoles();
      fetchAuditLog();
    } catch (error) {
      console.error('Error revoking admin:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de révoquer le rôle",
        variant: "destructive",
      });
    } finally {
      setRevokingUserId(null);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!user || !isAdminOrSuper) {
    return null;
  }

  const filteredBonuses = recentBonuses.filter(b => 
    b.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLoyaltyUsers = recentLoyaltyUsers.filter(l => 
    l.display_name.toLowerCase().includes(loyaltySearchTerm.toLowerCase())
  );

  const filteredUsersWithRoles = usersWithRoles.filter(u =>
    u.display_name.toLowerCase().includes(rolesSearchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(rolesSearchTerm.toLowerCase())
  );

  const getRoleBadge = (role: 'super_admin' | 'admin' | null) => {
    if (role === 'super_admin') {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Super Admin
        </Badge>
      );
    }
    if (role === 'admin') {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <ShieldCheck className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      );
    }
    return <Badge variant="outline">Utilisateur</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent/20 via-accent/10 to-background border-b">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/profile')}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  <Shield className="w-8 h-8 text-accent" />
                  Administration
                </h1>
                <p className="text-muted-foreground">
                  Gestion des utilisateurs et ressources
                </p>
              </div>
            </div>
            {isSuperAdmin ? (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Crown className="w-3 h-3 mr-1" />
                Super Admin
              </Badge>
            ) : (
              <Badge variant="outline" className="border-accent text-accent">
                Admin
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Tabs defaultValue="tokens" className="space-y-6">
          <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="tokens" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Tokens NDG</span>
              <span className="sm:hidden">Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              <span className="hidden sm:inline">Points Fidélité</span>
              <span className="sm:hidden">Fidélité</span>
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="roles" className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Rôles</span>
                <span className="sm:hidden">Rôles</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* TOKENS TAB */}
          <TabsContent value="tokens" className="space-y-6">
            <Card className="border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-accent" />
                  Octroyer des Tokens
                </CardTitle>
                <CardDescription>
                  Ajouter des Token Ndogmoabeng à un utilisateur via son pseudo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="displayName">Pseudo de l'utilisateur</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="displayName"
                        placeholder="Entrez le pseudo exact..."
                        value={targetDisplayName}
                        onChange={(e) => setTargetDisplayName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokens">Nombre de tokens</Label>
                    <Input
                      id="tokens"
                      type="number"
                      min={1}
                      value={tokensToGrant}
                      onChange={(e) => setTokensToGrant(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    <Zap className="inline w-4 h-4 mr-1 text-accent" />
                    1 Token = 1 initialisation OU 1 partie avec avantage clan
                  </p>
                  <Button 
                    onClick={handleGrantTokens} 
                    disabled={grantLoading || !targetDisplayName.trim()}
                    className="bg-accent hover:bg-accent/90"
                  >
                    {grantLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Gift className="w-4 h-4 mr-2" />
                    )}
                    Octroyer
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Historique des Tokens
                </CardTitle>
                <CardDescription>
                  Utilisateurs ayant reçu des tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par pseudo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {loadingBonuses ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : filteredBonuses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun utilisateur avec des tokens bonus
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pseudo</TableHead>
                        <TableHead className="text-center">Tokens</TableHead>
                        <TableHead className="text-right">Dernière modif.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBonuses.map((bonus) => (
                        <TableRow key={bonus.user_id}>
                          <TableCell className="font-medium">{bonus.display_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              <Zap className="w-3 h-3 mr-1" />
                              {bonus.token_balance}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {format(new Date(bonus.updated_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* LOYALTY TAB */}
          <TabsContent value="loyalty" className="space-y-6">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary" />
                  Octroyer des Points de Fidélité
                </CardTitle>
                <CardDescription>
                  Ajouter des points de fidélité NDG avec une note explicative
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="loyaltyDisplayName">Pseudo de l'utilisateur</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="loyaltyDisplayName"
                        placeholder="Entrez le pseudo exact..."
                        value={loyaltyTargetDisplayName}
                        onChange={(e) => setLoyaltyTargetDisplayName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points">Nombre de points</Label>
                    <Input
                      id="points"
                      type="number"
                      min={1}
                      value={pointsToGrant}
                      onChange={(e) => setPointsToGrant(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loyaltyNote">Note explicative (obligatoire)</Label>
                  <Textarea
                    id="loyaltyNote"
                    placeholder="Ex: Paiement place en cash, Bonus fidélité spécial..."
                    value={loyaltyNote}
                    onChange={(e) => setLoyaltyNote(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-muted-foreground">
                    <Star className="inline w-4 h-4 mr-1 text-primary" />
                    1€ dépensé = 1 point de fidélité
                  </p>
                  <Button 
                    onClick={handleGrantLoyaltyPoints} 
                    disabled={loyaltyGrantLoading || !loyaltyTargetDisplayName.trim() || !loyaltyNote.trim()}
                  >
                    {loyaltyGrantLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Star className="w-4 h-4 mr-2" />
                    )}
                    Octroyer
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Utilisateurs avec Points Fidélité
                </CardTitle>
                <CardDescription>
                  Classement par points cumulés
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par pseudo..."
                      value={loyaltySearchTerm}
                      onChange={(e) => setLoyaltySearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {loadingLoyalty ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : filteredLoyaltyUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun utilisateur avec des points de fidélité
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pseudo</TableHead>
                        <TableHead className="text-center">Solde</TableHead>
                        <TableHead className="text-center">Total gagné</TableHead>
                        <TableHead className="text-right">Dernière modif.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLoyaltyUsers.map((loyaltyUser) => (
                        <TableRow key={loyaltyUser.user_id}>
                          <TableCell className="font-medium">{loyaltyUser.display_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge>
                              <Star className="w-3 h-3 mr-1" />
                              {loyaltyUser.balance}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {loyaltyUser.total_earned} pts
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {format(new Date(loyaltyUser.updated_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROLES TAB - Super Admin only */}
          {isSuperAdmin && (
            <TabsContent value="roles" className="space-y-6">
              <Card className="border-amber-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-amber-400" />
                    Promouvoir un Administrateur
                  </CardTitle>
                  <CardDescription>
                    Donner les droits d'administration à un utilisateur existant
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="promoteDisplayName">Pseudo de l'utilisateur à promouvoir</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="promoteDisplayName"
                        placeholder="Entrez le pseudo exact..."
                        value={promoteDisplayName}
                        onChange={(e) => setPromoteDisplayName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      <ShieldAlert className="inline w-4 h-4 mr-1 text-amber-400" />
                      Cette action donnera un accès complet à l'administration
                    </p>
                    <Button 
                      onClick={handlePromoteToAdmin} 
                      disabled={promotingUser || !promoteDisplayName.trim()}
                      className="bg-amber-500 hover:bg-amber-600 text-black"
                    >
                      {promotingUser ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4 mr-2" />
                      )}
                      Promouvoir Admin
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    Utilisateurs avec Rôles
                  </CardTitle>
                  <CardDescription>
                    Liste des administrateurs et super administrateurs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher par pseudo ou email..."
                        value={rolesSearchTerm}
                        onChange={(e) => setRolesSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {loadingRoles ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                    </div>
                  ) : filteredUsersWithRoles.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun utilisateur avec un rôle spécial
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pseudo</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Rôle</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsersWithRoles.map((userRole) => (
                          <TableRow key={userRole.user_id}>
                            <TableCell className="font-medium">{userRole.display_name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {userRole.email}
                            </TableCell>
                            <TableCell className="text-center">
                              {getRoleBadge(userRole.role)}
                            </TableCell>
                            <TableCell className="text-right">
                              {userRole.role === 'admin' && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={revokingUserId === userRole.user_id}
                                    >
                                      {revokingUserId === userRole.user_id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <UserX className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Révoquer le rôle admin ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {userRole.display_name} perdra ses droits d'administration.
                                        Cette action peut être annulée en le promouvant à nouveau.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => handleRevokeAdmin(userRole.user_id, userRole.display_name)}
                                      >
                                        Révoquer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {userRole.role === 'super_admin' && (
                                <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                                  Protégé
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Audit Log */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-muted-foreground" />
                    Historique des Actions
                  </CardTitle>
                  <CardDescription>
                    Journal des promotions et révocations de rôles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAuditLog ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                    </div>
                  ) : auditLog.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune action enregistrée
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Effectuée par</TableHead>
                          <TableHead>Utilisateur cible</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLog.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                            </TableCell>
                            <TableCell>
                              {entry.action === 'PROMOTE_ADMIN' ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Promotion
                                </Badge>
                              ) : entry.action === 'REVOKE_ADMIN' ? (
                                <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                                  <UserX className="w-3 h-3 mr-1" />
                                  Révocation
                                </Badge>
                              ) : entry.action === 'GRANT_TOKENS' ? (
                                <Badge className="bg-accent/20 text-accent border-accent/30">
                                  <Zap className="w-3 h-3 mr-1" />
                                  +{entry.details?.tokens_count || '?'} Tokens
                                </Badge>
                              ) : entry.action === 'GRANT_LOYALTY' ? (
                                <Badge className="bg-primary/20 text-primary border-primary/30">
                                  <Star className="w-3 h-3 mr-1" />
                                  +{entry.details?.points_count || '?'} Points
                                </Badge>
                              ) : (
                                <Badge variant="outline">{entry.action}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.performed_by_email}
                            </TableCell>
                            <TableCell>
                              {entry.details?.display_name || entry.target_user_email}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
