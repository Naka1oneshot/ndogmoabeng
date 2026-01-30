import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, ChevronLeft, Users, Settings, Play, Save, AlertTriangle, Check, X,
  Coins, Waves, Trees, Shield, Skull, Crown, RefreshCw, ArrowLeftRight, Map
} from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  mode: string;
  adventure_id: string | null;
  current_step_index: number;
  starting_tokens: number;
  host_user_id: string;
}

interface Player {
  id: string;
  player_number: number | null;
  display_name: string;
  status: string | null;
  mate_num: number | null;
  is_host: boolean;
  clan: string | null;
  jetons: number | null;
  pvic: number | null;
}

interface AdventureStep {
  id: string;
  step_index: number;
  game_type_code: string;
  token_policy: string;
  custom_starting_tokens: number | null;
}

interface GameType {
  code: string;
  name: string;
  min_players: number | null;
}

interface Monster {
  id: number;
  name: string;
  pv_max_default: number;
  reward_default: number;
}

interface AdventureConfig {
  start_requirements: {
    enforceMinPlayersAllSteps: boolean;
  };
  token_policies: Record<string, { mode: 'INHERIT' | 'FIXED'; fixedValue: number }>;
  adventure_pot: {
    initialAmount: number;
    currentAmount: number;
  };
  rivieres_penalty: {
    enabled: boolean;
    minSuccessLevel: number;
    potPenaltyAmount: number;
  };
  foret_monsters: {
    selected: Array<{
      monster_id: number;
      enabled: boolean;
      pv_max_override: number | null;
      reward_override: number | null;
    }>;
  };
  sheriff_config: {
    visa_pvic_percent: number;
    duel_max_impact: number;
    cost_per_player: number;
    floor_percent: number;
  };
  lion_config: {
    timer_enabled: boolean;
    auto_resolve: boolean;
  };
}

const DEFAULT_CONFIG: AdventureConfig = {
  start_requirements: {
    enforceMinPlayersAllSteps: true,
  },
  token_policies: {
    RIVIERES: { mode: 'FIXED', fixedValue: 100 },
    FORET: { mode: 'FIXED', fixedValue: 50 },
    SHERIFF: { mode: 'FIXED', fixedValue: 20 },
    INFECTION: { mode: 'INHERIT', fixedValue: 0 },
    LION: { mode: 'INHERIT', fixedValue: 0 },
  },
  adventure_pot: {
    initialAmount: 0,
    currentAmount: 0,
  },
  rivieres_penalty: {
    enabled: false,
    minSuccessLevel: 9,
    potPenaltyAmount: 50,
  },
  foret_monsters: {
    selected: [],
  },
  sheriff_config: {
    visa_pvic_percent: 50,
    duel_max_impact: 10,
    cost_per_player: 5,
    floor_percent: 40,
  },
  lion_config: {
    timer_enabled: false,
    auto_resolve: true,
  },
};

const GAME_TYPE_INFO: Record<string, { label: string; emoji: string; colorClass: string }> = {
  RIVIERES: { label: 'Rivières', emoji: '🌊', colorClass: 'text-blue-400' },
  FORET: { label: 'Forêt', emoji: '🌲', colorClass: 'text-emerald-400' },
  SHERIFF: { label: 'Shérif', emoji: '🤠', colorClass: 'text-amber-400' },
  INFECTION: { label: 'Infection', emoji: '🧟', colorClass: 'text-purple-400' },
  LION: { label: 'CŒUR du Lion', emoji: '🦁', colorClass: 'text-orange-400' },
};

export default function MJAdventureDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isAdminOrSuper, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [steps, setSteps] = useState<AdventureStep[]>([]);
  const [gameTypes, setGameTypes] = useState<GameType[]>([]);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [config, setConfig] = useState<AdventureConfig>(DEFAULT_CONFIG);
  const [adventureName, setAdventureName] = useState<string>('');

  // Player number editing
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [newPlayerNumber, setNewPlayerNumber] = useState<number>(1);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && gameId && !authLoading && !roleLoading) {
      fetchData();
    }
  }, [user, gameId, authLoading, roleLoading]);

  const fetchData = async () => {
    if (!gameId || !user) return;
    setLoading(true);

    try {
      // Fetch game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (gameError || !gameData) {
        toast.error('Partie non trouvée');
        navigate('/mj');
        return;
      }

      // Check permission
      if (gameData.host_user_id !== user.id && !isAdminOrSuper) {
        toast.error('Accès non autorisé');
        navigate('/mj');
        return;
      }

      // Verify it's an adventure
      if (gameData.mode !== 'ADVENTURE' || !gameData.adventure_id) {
        toast.error('Cette partie n\'est pas une aventure');
        navigate(`/mj/${gameId}`);
        return;
      }

      setGame(gameData as Game);

      // Fetch adventure name
      const { data: adventureData } = await supabase
        .from('adventures')
        .select('name')
        .eq('id', gameData.adventure_id)
        .single();
      
      if (adventureData) {
        setAdventureName(adventureData.name);
      }

      // Fetch adventure steps
      const { data: stepsData } = await supabase
        .from('adventure_steps')
        .select('*')
        .eq('adventure_id', gameData.adventure_id)
        .order('step_index');

      setSteps(stepsData || []);

      // Fetch game types for min player requirements
      const { data: gameTypesData } = await supabase
        .from('game_types')
        .select('code, name, min_players');

      setGameTypes(gameTypesData || []);

      // Fetch players
      const { data: playersData } = await supabase
        .from('game_players')
        .select('id, player_number, display_name, status, mate_num, is_host, clan, jetons, pvic')
        .eq('game_id', gameId)
        .is('removed_at', null)
        .order('player_number');

      setPlayers(playersData?.filter(p => !p.is_host) || []);

      // Fetch monsters for Forêt config
      const { data: monstersData } = await supabase
        .from('monster_catalog')
        .select('id, name, pv_max_default, reward_default')
        .eq('is_default_in_pool', true)
        .order('id');

      setMonsters(monstersData || []);

      // Fetch or create adventure_game_configs
      const { data: configData } = await supabase
        .from('adventure_game_configs')
        .select('config')
        .eq('game_id', gameId)
        .single();

      if (configData?.config) {
        // Merge with defaults to handle new properties
        const savedConfig = configData.config as unknown as AdventureConfig;
        setConfig({
          ...DEFAULT_CONFIG,
          ...savedConfig,
          start_requirements: { ...DEFAULT_CONFIG.start_requirements, ...savedConfig.start_requirements },
          token_policies: { ...DEFAULT_CONFIG.token_policies, ...savedConfig.token_policies },
          adventure_pot: { ...DEFAULT_CONFIG.adventure_pot, ...savedConfig.adventure_pot },
          rivieres_penalty: { ...DEFAULT_CONFIG.rivieres_penalty, ...savedConfig.rivieres_penalty },
          foret_monsters: { ...DEFAULT_CONFIG.foret_monsters, ...savedConfig.foret_monsters },
          sheriff_config: { ...DEFAULT_CONFIG.sheriff_config, ...savedConfig.sheriff_config },
          lion_config: { ...DEFAULT_CONFIG.lion_config, ...savedConfig.lion_config },
        });
      } else {
        // Create initial config with monster defaults
        const initialMonsters = (monstersData || []).map(m => ({
          monster_id: m.id,
          enabled: true,
          pv_max_override: null,
          reward_override: null,
        }));
        const initialConfig = { ...DEFAULT_CONFIG, foret_monsters: { selected: initialMonsters } };
        setConfig(initialConfig);

        // Upsert to DB
        await supabase.from('adventure_game_configs').upsert({
          game_id: gameId,
          adventure_id: gameData.adventure_id,
          config: initialConfig as unknown as Json,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!gameId || !game) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('adventure_game_configs')
        .upsert({
          game_id: gameId,
          adventure_id: game.adventure_id,
          config: config as unknown as Json,
        });

      if (error) throw error;
      toast.success('Configuration sauvegardée');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Calculate if ready to start
  const getMinPlayersForStep = (gameTypeCode: string): number => {
    const gt = gameTypes.find(t => t.code === gameTypeCode);
    return gt?.min_players || 2;
  };

  const playerCount = players.filter(p => p.status === 'ACTIVE').length;
  
  const stepsWithMinPlayers = steps.map(step => ({
    ...step,
    minPlayers: getMinPlayersForStep(step.game_type_code),
    meetsRequirement: playerCount >= getMinPlayersForStep(step.game_type_code),
  }));

  const allStepsMeetRequirements = stepsWithMinPlayers.every(s => s.meetsRequirement);
  const canStart = config.start_requirements.enforceMinPlayersAllSteps 
    ? allStepsMeetRequirements 
    : playerCount >= (stepsWithMinPlayers[0]?.minPlayers || 2);

  const handleStartAdventure = async () => {
    if (!gameId || !game || !canStart) return;
    setStarting(true);

    try {
      // Save config first
      await supabase.from('adventure_game_configs').upsert({
        game_id: gameId,
        adventure_id: game.adventure_id,
        config: { ...config, adventure_pot: { ...config.adventure_pot, currentAmount: config.adventure_pot.initialAmount } } as unknown as Json,
      });

      // Get first step
      const firstStep = steps[0];
      if (!firstStep) {
        toast.error('Aucune étape configurée pour cette aventure');
        return;
      }

      // Create session_game for step 1 if not exists
      const { data: existingSession } = await supabase
        .from('session_games')
        .select('id')
        .eq('session_id', gameId)
        .eq('step_index', 1)
        .maybeSingle();

      let sessionGameId = existingSession?.id;

      if (!sessionGameId) {
        const { data: newSession, error: sessionError } = await supabase
          .from('session_games')
          .insert({
            session_id: gameId,
            game_type_code: firstStep.game_type_code,
            step_index: 1,
            status: 'PENDING',
            manche_active: 1,
            phase: 'PHASE1_MISES',
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        sessionGameId = newSession.id;
      }

      // Apply token policy for first step
      const tokenPolicy = config.token_policies[firstStep.game_type_code];
      const startingTokens = tokenPolicy?.mode === 'FIXED' ? tokenPolicy.fixedValue : 100;

      // Update players with starting tokens (with Royaux bonus)
      for (const player of players.filter(p => p.status === 'ACTIVE')) {
        const jetons = player.clan === 'Royaux' ? Math.floor(startingTokens * 1.5) : startingTokens;
        await supabase
          .from('game_players')
          .update({ jetons, pvic: 0, recompenses: 0 })
          .eq('id', player.id);
      }

      // Update game status
      await supabase
        .from('games')
        .update({
          status: 'IN_GAME',
          phase: 'SESSION_ACTIVE',
          current_session_game_id: sessionGameId,
          current_step_index: 1,
          selected_game_type_code: firstStep.game_type_code,
          starting_tokens: startingTokens,
        })
        .eq('id', gameId);

      // Log event
      await supabase.from('session_events').insert({
        game_id: gameId,
        session_game_id: sessionGameId,
        type: 'ADVENTURE_START',
        message: `🏔️ L'aventure "${adventureName}" commence avec ${playerCount} joueurs !`,
        audience: 'ALL',
      });

      toast.success('Aventure démarrée !');
      navigate(`/mj/${gameId}`);
    } catch (error) {
      console.error('Error starting adventure:', error);
      toast.error('Erreur lors du démarrage');
    } finally {
      setStarting(false);
    }
  };

  const handleSwapPlayerNumber = async (playerId: string, newNumber: number) => {
    if (!gameId) return;

    try {
      const { data, error } = await supabase.rpc('swap_player_numbers', {
        p_game_id: gameId,
        p_player_id: playerId,
        p_new_number: newNumber,
      });

      if (error) throw error;

      const result = data as { success: boolean; message?: string; error?: string };
      if (!result.success) {
        toast.error(result.error || 'Erreur lors du changement');
        return;
      }

      toast.success(result.message || 'Numéro mis à jour');
      setEditingPlayerId(null);
      fetchData();
    } catch (error) {
      console.error('Error swapping player number:', error);
      toast.error('Erreur lors du changement');
    }
  };

  const updateConfig = <K extends keyof AdventureConfig>(
    section: K,
    updates: Partial<AdventureConfig[K]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  };

  const updateTokenPolicy = (gameType: string, mode: 'INHERIT' | 'FIXED', fixedValue?: number) => {
    setConfig(prev => ({
      ...prev,
      token_policies: {
        ...prev.token_policies,
        [gameType]: { 
          mode, 
          fixedValue: fixedValue ?? prev.token_policies[gameType]?.fixedValue ?? 0 
        },
      },
    }));
  };

  const updateMonsterConfig = (monsterId: number, updates: Partial<{ enabled: boolean; pv_max_override: number | null; reward_override: number | null }>) => {
    setConfig(prev => ({
      ...prev,
      foret_monsters: {
        selected: prev.foret_monsters.selected.map(m =>
          m.monster_id === monsterId ? { ...m, ...updates } : m
        ),
      },
    }));
  };

  const resetMonsterOverrides = () => {
    setConfig(prev => ({
      ...prev,
      foret_monsters: {
        selected: prev.foret_monsters.selected.map(m => ({
          ...m,
          pv_max_override: null,
          reward_override: null,
        })),
      },
    }));
    toast.info('Overrides réinitialisés');
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !game) return null;

  return (
    <div className="min-h-screen px-4 py-6">
      <main className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <ForestButton variant="ghost" size="sm" onClick={() => navigate('/mj')}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour
            </ForestButton>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Map className="h-6 w-6 text-amber-400" />
                Dashboard Aventure
              </h1>
              <p className="text-muted-foreground">
                {game.name} • <span className="text-amber-400">{adventureName}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ForestButton variant="outline" onClick={handleSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder
            </ForestButton>
            <ForestButton 
              onClick={handleStartAdventure} 
              disabled={!canStart || starting || game.status !== 'LOBBY'}
              className="bg-gradient-to-r from-amber-600 to-orange-600"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Démarrer l'aventure
            </ForestButton>
          </div>
        </div>

        {game.status !== 'LOBBY' && (
          <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <p className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              L'aventure est déjà en cours. Utilisez le{' '}
              <Link to={`/mj/${gameId}`} className="underline">dashboard MJ classique</Link>
              {' '}pour gérer la partie.
            </p>
          </div>
        )}

        <Tabs defaultValue="prerequisites" className="space-y-6">
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-1">
            <TabsTrigger value="prerequisites" className="text-xs">Prérequis</TabsTrigger>
            <TabsTrigger value="tokens" className="text-xs">Jetons</TabsTrigger>
            <TabsTrigger value="pot" className="text-xs">Cagnotte</TabsTrigger>
            <TabsTrigger value="rivieres" className="text-xs">Rivières</TabsTrigger>
            <TabsTrigger value="foret" className="text-xs">Forêt</TabsTrigger>
            <TabsTrigger value="sheriff" className="text-xs">Shérif</TabsTrigger>
            <TabsTrigger value="lion" className="text-xs">Lion</TabsTrigger>
            <TabsTrigger value="players" className="text-xs">Joueurs</TabsTrigger>
          </TabsList>

          {/* Prerequisites Tab */}
          <TabsContent value="prerequisites">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Prérequis de Démarrage
                </CardTitle>
                <CardDescription>
                  Vérifiez que toutes les conditions sont remplies avant de lancer l'aventure.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label className="text-base">Joueurs actuels</Label>
                    <p className="text-2xl font-bold text-primary">{playerCount}</p>
                  </div>
                  <Badge variant={allStepsMeetRequirements ? 'default' : 'destructive'} className="text-lg px-4 py-2">
                    {allStepsMeetRequirements ? 'Prêt' : 'Insuffisant'}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <Switch
                    checked={config.start_requirements.enforceMinPlayersAllSteps}
                    onCheckedChange={(checked) => 
                      updateConfig('start_requirements', { enforceMinPlayersAllSteps: checked })
                    }
                  />
                  <div>
                    <Label>Vérifier les minima pour toutes les étapes</Label>
                    <p className="text-sm text-muted-foreground">
                      Si activé, l'aventure ne peut démarrer que si le nombre de joueurs est suffisant pour TOUTES les étapes.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base">Étapes de l'aventure</Label>
                  {stepsWithMinPlayers.map((step) => {
                    const info = GAME_TYPE_INFO[step.game_type_code];
                    return (
                      <div 
                        key={step.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          step.meetsRequirement ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{info?.emoji || '🎮'}</span>
                          <div>
                            <p className={`font-medium ${info?.colorClass || ''}`}>
                              Étape {step.step_index}: {info?.label || step.game_type_code}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Minimum: {step.minPlayers} joueurs
                            </p>
                          </div>
                        </div>
                        {step.meetsRequirement ? (
                          <Check className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <X className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tokens Tab */}
          <TabsContent value="tokens">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Politique de Jetons
                </CardTitle>
                <CardDescription>
                  Définissez comment les jetons sont distribués à chaque étape.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(GAME_TYPE_INFO).map(([code, info]) => {
                  const policy = config.token_policies[code] || { mode: 'INHERIT', fixedValue: 0 };
                  const stepExists = steps.some(s => s.game_type_code === code);
                  
                  if (!stepExists) return null;
                  
                  return (
                    <div key={code} className="flex items-center gap-4 p-4 rounded-lg border">
                      <span className="text-2xl">{info.emoji}</span>
                      <div className="flex-1">
                        <p className={`font-medium ${info.colorClass}`}>{info.label}</p>
                      </div>
                      <Select
                        value={policy.mode}
                        onValueChange={(value: 'INHERIT' | 'FIXED') => updateTokenPolicy(code, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INHERIT">Hériter</SelectItem>
                          <SelectItem value="FIXED">Fixe</SelectItem>
                        </SelectContent>
                      </Select>
                      {policy.mode === 'FIXED' && (
                        <NumberInput
                          value={policy.fixedValue}
                          onChange={(value) => updateTokenPolicy(code, 'FIXED', value)}
                          min={0}
                          max={1000}
                          className="w-24"
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pot Tab */}
          <TabsContent value="pot">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Cagnotte Aventure
                </CardTitle>
                <CardDescription>
                  Un pot commun qui peut être affecté par les performances des joueurs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Montant initial</Label>
                    <NumberInput
                      value={config.adventure_pot.initialAmount}
                      onChange={(value) => updateConfig('adventure_pot', { initialAmount: value })}
                      min={0}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Montant actuel</Label>
                    <div className="mt-1 h-10 flex items-center px-3 rounded-md border bg-muted/50 text-muted-foreground">
                      {config.adventure_pot.currentAmount}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Au démarrage de l'aventure, le montant actuel sera égal au montant initial.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rivieres Tab */}
          <TabsContent value="rivieres">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5 text-blue-400" />
                  Rivières — Pénalité Cagnotte
                </CardTitle>
                <CardDescription>
                  Appliquez une pénalité à la cagnotte si les joueurs n'atteignent pas un certain niveau.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <Switch
                    checked={config.rivieres_penalty.enabled}
                    onCheckedChange={(checked) => 
                      updateConfig('rivieres_penalty', { enabled: checked })
                    }
                  />
                  <div>
                    <Label>Activer la pénalité</Label>
                    <p className="text-sm text-muted-foreground">
                      Si le niveau de succès est inférieur au minimum, la cagnotte est réduite.
                    </p>
                  </div>
                </div>

                {config.rivieres_penalty.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Niveau minimum de succès</Label>
                      <NumberInput
                        value={config.rivieres_penalty.minSuccessLevel}
                        onChange={(value) => updateConfig('rivieres_penalty', { minSuccessLevel: value })}
                        min={1}
                        max={15}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Pénalité (déduction cagnotte)</Label>
                      <NumberInput
                        value={config.rivieres_penalty.potPenaltyAmount}
                        onChange={(value) => updateConfig('rivieres_penalty', { potPenaltyAmount: value })}
                        min={0}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Foret Tab */}
          <TabsContent value="foret">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trees className="h-5 w-5 text-emerald-400" />
                  Forêt — Configuration Monstres
                </CardTitle>
                <CardDescription>
                  Personnalisez les monstres actifs et leurs statistiques.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <ForestButton variant="outline" size="sm" onClick={resetMonsterOverrides}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset overrides
                  </ForestButton>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {monsters.map((monster) => {
                      const monsterConfig = config.foret_monsters.selected.find(m => m.monster_id === monster.id);
                      const enabled = monsterConfig?.enabled ?? true;
                      
                      return (
                        <div 
                          key={monster.id} 
                          className={`p-4 rounded-lg border ${enabled ? '' : 'opacity-50'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={enabled}
                                onCheckedChange={(checked) => updateMonsterConfig(monster.id, { enabled: checked })}
                              />
                              <span className="font-medium">{monster.name}</span>
                            </div>
                          </div>
                          {enabled && (
                            <div className="grid grid-cols-2 gap-4 mt-2">
                              <div>
                                <Label className="text-xs">PV Max (défaut: {monster.pv_max_default})</Label>
                                <Input
                                  type="number"
                                  placeholder={String(monster.pv_max_default)}
                                  value={monsterConfig?.pv_max_override ?? ''}
                                  onChange={(e) => updateMonsterConfig(monster.id, { 
                                    pv_max_override: e.target.value ? parseInt(e.target.value) : null 
                                  })}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Récompense (défaut: {monster.reward_default})</Label>
                                <Input
                                  type="number"
                                  placeholder={String(monster.reward_default)}
                                  value={monsterConfig?.reward_override ?? ''}
                                  onChange={(e) => updateMonsterConfig(monster.id, { 
                                    reward_override: e.target.value ? parseInt(e.target.value) : null 
                                  })}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sheriff Tab */}
          <TabsContent value="sheriff">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-400" />
                  Shérif — Variables de Duel
                </CardTitle>
                <CardDescription>
                  Configurez les paramètres économiques du jeu du Shérif.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <Label>% gain VISA pour PVic</Label>
                  <NumberInput
                    value={config.sheriff_config.visa_pvic_percent}
                    onChange={(value) => updateConfig('sheriff_config', { visa_pvic_percent: value })}
                    min={0}
                    max={100}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Pourcentage de PVic gagné par passage légal</p>
                </div>
                <div>
                  <Label>Impact max duel (%)</Label>
                  <NumberInput
                    value={config.sheriff_config.duel_max_impact}
                    onChange={(value) => updateConfig('sheriff_config', { duel_max_impact: value })}
                    min={0}
                    max={100}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Impact maximum sur les scores de duel</p>
                </div>
                <div>
                  <Label>Coût par joueur</Label>
                  <NumberInput
                    value={config.sheriff_config.cost_per_player}
                    onChange={(value) => updateConfig('sheriff_config', { cost_per_player: value })}
                    min={0}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Coût d'entrée prélevé sur la pool</p>
                </div>
                <div>
                  <Label>Floor percent (%)</Label>
                  <NumberInput
                    value={config.sheriff_config.floor_percent}
                    onChange={(value) => updateConfig('sheriff_config', { floor_percent: value })}
                    min={0}
                    max={100}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Pourcentage plancher de la pool</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lion Tab */}
          <TabsContent value="lion">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Skull className="h-5 w-5 text-orange-400" />
                  Le CŒUR du Lion — Variables
                </CardTitle>
                <CardDescription>
                  Configurez le comportement du duel final entre les deux finalistes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <Switch
                    checked={config.lion_config.timer_enabled}
                    onCheckedChange={(checked) => 
                      updateConfig('lion_config', { timer_enabled: checked })
                    }
                  />
                  <div>
                    <Label>Activer le timer</Label>
                    <p className="text-sm text-muted-foreground">
                      Limite de temps pour chaque tour
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <Switch
                    checked={config.lion_config.auto_resolve}
                    onCheckedChange={(checked) => 
                      updateConfig('lion_config', { auto_resolve: checked })
                    }
                  />
                  <div>
                    <Label>Résolution automatique</Label>
                    <p className="text-sm text-muted-foreground">
                      Résoudre automatiquement les tours quand les deux joueurs ont joué
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5" />
                  Gestion des Joueurs
                </CardTitle>
                <CardDescription>
                  Modifiez les numéros de joueurs. Les échanges sont automatiques en cas de doublon.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div 
                      key={player.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="w-10 justify-center">
                          #{player.player_number ?? '-'}
                        </Badge>
                        <div>
                          <p className="font-medium">{player.display_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {player.clan && <span className="mr-2">{player.clan}</span>}
                            {player.mate_num && <span>Équipier: #{player.mate_num}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={player.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className={player.status === 'SPECTATOR' ? 'bg-purple-500/20 text-purple-400' : ''}
                        >
                          {player.status || 'ACTIVE'}
                        </Badge>
                        {editingPlayerId === player.id ? (
                          <div className="flex items-center gap-2">
                            <NumberInput
                              value={newPlayerNumber}
                              onChange={setNewPlayerNumber}
                              min={1}
                              max={99}
                              className="w-20"
                            />
                            <ForestButton 
                              size="sm" 
                              onClick={() => handleSwapPlayerNumber(player.id, newPlayerNumber)}
                            >
                              <Check className="h-4 w-4" />
                            </ForestButton>
                            <ForestButton 
                              size="sm" 
                              variant="ghost"
                              onClick={() => setEditingPlayerId(null)}
                            >
                              <X className="h-4 w-4" />
                            </ForestButton>
                          </div>
                        ) : (
                          <ForestButton 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setEditingPlayerId(player.id);
                              setNewPlayerNumber(player.player_number || 1);
                            }}
                          >
                            Changer #
                          </ForestButton>
                        )}
                      </div>
                    </div>
                  ))}
                  {players.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun joueur n'a encore rejoint la partie.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
