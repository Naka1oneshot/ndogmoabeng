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
import { 
  Shield, 
  Zap, 
  Search, 
  Gift,
  Loader2,
  ChevronLeft,
  User,
  Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserBonus {
  user_id: string;
  display_name: string;
  token_games_creatable: number;
  trial_tier: string;
  trial_end_at: string;
  updated_at: string;
}

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [targetDisplayName, setTargetDisplayName] = useState('');
  const [tokensToGrant, setTokensToGrant] = useState(10);
  const [grantLoading, setGrantLoading] = useState(false);
  const [recentBonuses, setRecentBonuses] = useState<UserBonus[]>([]);
  const [loadingBonuses, setLoadingBonuses] = useState(true);

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
    }
  }, [isAdmin]);

  const fetchRecentBonuses = async () => {
    setLoadingBonuses(true);
    try {
      const { data: bonuses, error } = await supabase
        .from('user_subscription_bonuses')
        .select('user_id, token_games_creatable, trial_tier, trial_end_at, updated_at')
        .gt('token_games_creatable', 0)
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
          tokens_creatable: tokensToGrant,
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
                  Gestion des Abonnements
                </h1>
                <p className="text-muted-foreground">
                  Octroyer des Token Ndogmoabeng aux utilisateurs
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-accent text-accent">
              Admin
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Grant Tokens Card */}
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
                1 Token = 10 initialisations de parties
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

        {/* Recent Bonuses */}
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
                    <TableHead className="text-center">Parties bonus</TableHead>
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
                          {Math.ceil(bonus.token_games_creatable / 10)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        +{bonus.token_games_creatable} parties
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
      </div>
    </div>
  );
}
