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
  Shield, 
  Zap, 
  Search, 
  Gift,
  Loader2,
  ChevronLeft,
  User,
  Clock,
  Star
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

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { state: { from: location.pathname } });
    }
  }, [user, authLoading, navigate, location.pathname]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast({
        title: "Accès refusé",
        description: "Vous n'avez pas les droits administrateur",
        variant: "destructive",
      });
      navigate('/profile');
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchRecentBonuses();
      fetchRecentLoyaltyUsers();
    }
  }, [isAdmin]);

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

      // Fetch display names for these users
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Session non valide");
      }

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

  if (!user || !isAdmin) {
    return null;
  }

  const filteredBonuses = recentBonuses.filter(b => 
    b.display_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLoyaltyUsers = recentLoyaltyUsers.filter(l => 
    l.display_name.toLowerCase().includes(loyaltySearchTerm.toLowerCase())
  );

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
                  Gestion Admin
                </h1>
                <p className="text-muted-foreground">
                  Tokens et Points de Fidélité
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-accent text-accent">
              Admin
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Tabs defaultValue="tokens" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tokens" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Tokens NDG
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Points Fidélité
            </TabsTrigger>
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
                      {filteredLoyaltyUsers.map((user) => (
                        <TableRow key={user.user_id}>
                          <TableCell className="font-medium">{user.display_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge>
                              <Star className="w-3 h-3 mr-1" />
                              {user.balance}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {user.total_earned} pts
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {format(new Date(user.updated_at), 'dd MMM yyyy', { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
