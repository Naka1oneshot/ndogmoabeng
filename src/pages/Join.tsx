import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { AdventureProgressDisplay } from '@/components/game/AdventureProgressDisplay';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, AlertCircle, Loader2, Shield, Lock, Coins } from 'lucide-react';
import { toast } from 'sonner';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

// Import clan images
import maisonRoyaleImg from '@/assets/clans/maison-royale.png';
import fraterniteZoulouImg from '@/assets/clans/fraternite-zoulous.png';
import maisonKeryndesImg from '@/assets/clans/maison-keryndes.png';
import akandeImg from '@/assets/clans/akande.png';
import cercleAseyraImg from '@/assets/clans/cercle-aseyra.png';
import sourcesAkilaImg from '@/assets/clans/sources-akila.png';
import ezkarImg from '@/assets/clans/ezkar.png';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: 'LOBBY' | 'IN_GAME' | 'ENDED';
  mode: string;
  current_step_index: number;
  selected_game_type_code: string | null;
}

const CLANS = [
  { value: 'maison-royale', label: 'Maison Royale', image: maisonRoyaleImg },
  { value: 'fraternite-zoulous', label: 'Fraternité Zoulous', image: fraterniteZoulouImg },
  { value: 'maison-keryndes', label: 'Maison des Keryndes', image: maisonKeryndesImg },
  { value: 'akande', label: 'Akandé', image: akandeImg },
  { value: 'cercle-aseyra', label: "Cercle d'Aséyra", image: cercleAseyraImg },
  { value: 'sources-akila', label: "Les Sources d'Akila", image: sourcesAkilaImg },
  { value: 'ezkar', label: 'Ezkar', image: ezkarImg },
];

export default function Join() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const subscription = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [code, setCode] = useState(codeFromUrl);
  const [displayName, setDisplayName] = useState('');
  const [selectedClan, setSelectedClan] = useState('');
  const [useTokenForClan, setUseTokenForClan] = useState(false);
  const [lockClan, setLockClan] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(!!codeFromUrl);
  const [joining, setJoining] = useState(false);

  // Determine if user is anonymous (no profile means anonymous)
  const isAnonymous = !user || !profile;

  // Check subscription benefits
  const hasClanBenefits = subscription.tier && subscription.tier !== 'freemium';
  const tokenBalance = subscription.token_bonus?.token_balance || 0;
  const canUseToken = tokenBalance > 0 && !hasClanBenefits;
  const canSelectClan = hasClanBenefits || useTokenForClan;

  // Set display name from profile when loaded
  useEffect(() => {
    if (profile?.display_name && !isAnonymous) {
      setDisplayName(profile.display_name);
    }
  }, [profile, isAnonymous]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=/join?code=${code}`);
    }
  }, [user, authLoading, navigate, code]);

  useEffect(() => {
    if (codeFromUrl && user) {
      checkGame(codeFromUrl);
    }
  }, [codeFromUrl, user]);

  // Reset clan selection when token usage changes
  useEffect(() => {
    if (!canSelectClan) {
      setSelectedClan('');
      setLockClan(false);
    }
  }, [canSelectClan]);

  const checkGame = async (joinCode: string) => {
    setChecking(true);
    setError('');
    setGame(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('join_code', joinCode.toUpperCase())
        .single();

      if (fetchError || !data) {
        setError('Partie introuvable');
        return;
      }

      if (data.status !== 'LOBBY') {
        setError('Cette partie a déjà commencé');
        return;
      }

      setGame(data as Game);
    } catch {
      setError('Erreur lors de la recherche');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckCode = () => {
    if (code.trim().length >= 6) {
      checkGame(code.trim());
    } else {
      setError('Code invalide');
    }
  };

  const handleJoin = async () => {
    if (!game || !user || !displayName.trim()) {
      toast.error('Veuillez entrer un pseudo');
      return;
    }

    setJoining(true);
    try {
      // Use edge function for atomic join
      const { data, error: joinError } = await supabase.functions.invoke('join-game', {
        body: {
          joinCode: game.join_code,
          displayName: displayName.trim(),
          clan: canSelectClan ? selectedClan : null,
          useTokenForClan: useTokenForClan && canUseToken,
          lockClan: lockClan && canSelectClan,
        },
      });

      if (joinError) {
        throw joinError;
      }

      if (data?.error) {
        if (data.error === 'BANNED') {
          toast.error('Vous avez été banni de cette partie');
        } else if (data.error === 'ALREADY_JOINED') {
          toast.info('Vous avez déjà rejoint cette partie');
        } else {
          toast.error(data.error);
        }
        if (data.gameId) {
          navigate(`/lobby?game=${data.gameId}`);
        }
        return;
      }

      navigate(`/lobby?game=${game.id}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error('Erreur lors de la connexion');
    } finally {
      setJoining(false);
    }
  };

  const isLoading = authLoading || profileLoading || subscription.loading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Theme toggle in top-right corner */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4 animate-float">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-display text-2xl text-glow mb-2">
            Rejoindre une partie
          </h1>
          <p className="text-muted-foreground">
            Entrez le code fourni par le Maître du Jeu
          </p>
        </div>

        <div className="card-gradient rounded-lg border border-border p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!game ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Code de la partie</Label>
                <Input
                  id="code"
                  placeholder="XXXXXX"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-display"
                />
              </div>

              <ForestButton 
                className="w-full" 
                onClick={handleCheckCode}
                disabled={checking || code.length < 6}
              >
                {checking ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Vérifier le code'
                )}
              </ForestButton>
            </>
          ) : (
            <>
              <div className="text-center p-4 bg-secondary/50 rounded-md space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Partie trouvée</p>
                  <p className="font-display text-lg">{game.name}</p>
                </div>
                
                {/* Adventure Progress Display */}
                <div className="flex justify-center">
                  <AdventureProgressDisplay
                    mode={game.mode}
                    currentStepIndex={game.current_step_index}
                    currentGameTypeCode={game.selected_game_type_code}
                  />
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Votre pseudo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    placeholder="Ex: Explorateur"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10"
                    disabled={!isAnonymous}
                    readOnly={!isAnonymous}
                  />
                </div>
                {!isAnonymous && (
                  <p className="text-xs text-muted-foreground">
                    Pseudo lié à votre compte
                  </p>
                )}
              </div>

              {/* Token Usage Option */}
              {canUseToken && (
                <div className="p-3 rounded-md bg-primary/10 border border-primary/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      Tokens disponibles : {tokenBalance}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useToken"
                      checked={useTokenForClan}
                      onCheckedChange={(checked) => setUseTokenForClan(checked === true)}
                    />
                    <label
                      htmlFor="useToken"
                      className="text-sm cursor-pointer leading-tight"
                    >
                      Utiliser 1 Token pour activer la sélection du clan
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Le token sera consommé lorsque le MJ lancera la partie
                  </p>
                </div>
              )}

              {/* Clan Selection */}
              <div className="space-y-2">
                <Label htmlFor="clan" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Clan
                  {!canSelectClan && (
                    <span className="text-xs text-muted-foreground font-normal">
                      (Avantage Clan requis)
                    </span>
                  )}
                </Label>
                <Select
                  value={selectedClan}
                  onValueChange={setSelectedClan}
                  disabled={!canSelectClan}
                >
                  <SelectTrigger className={!canSelectClan ? 'opacity-50' : ''}>
                    <SelectValue placeholder={canSelectClan ? "Sélectionnez votre clan" : "Non disponible"} />
                  </SelectTrigger>
                  <SelectContent>
                    {CLANS.map((clan) => (
                      <SelectItem key={clan.value} value={clan.value}>
                        <div className="flex items-center gap-2">
                          <img src={clan.image} alt={clan.label} className="w-6 h-6 rounded object-cover" />
                          <span>{clan.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canSelectClan && !canUseToken && (
                  <p className="text-xs text-muted-foreground">
                    Abonnez-vous ou utilisez des Tokens pour sélectionner un clan
                  </p>
                )}
              </div>

              {/* Lock Clan Option */}
              {canSelectClan && selectedClan && (
                <div className="flex items-center space-x-2 p-3 rounded-md bg-secondary/50">
                  <Checkbox
                    id="lockClan"
                    checked={lockClan}
                    onCheckedChange={(checked) => setLockClan(checked === true)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="lockClan"
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <Lock className="h-3 w-3" />
                      Verrouiller mon choix de clan
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Le MJ ne pourra pas modifier votre clan
                    </p>
                  </div>
                </div>
              )}

              <ForestButton 
                className="w-full" 
                onClick={handleJoin}
                disabled={joining || !displayName.trim()}
              >
                {joining ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  'Rejoindre la partie'
                )}
              </ForestButton>

              <button
                type="button"
                onClick={() => {
                  setGame(null);
                  setCode('');
                  setError('');
                  setSelectedClan('');
                  setUseTokenForClan(false);
                  setLockClan(false);
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Changer de code
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
