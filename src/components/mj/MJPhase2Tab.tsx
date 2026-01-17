import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, Target, Swords, Users, ClipboardList,
  CheckCircle2, AlertCircle, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Game {
  id: string;
  status: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface MJPhase2TabProps {
  game: Game;
  onGameUpdate: () => void;
}

interface Player {
  id: string;
  player_number: number;
  display_name: string;
  clan: string | null;
}

interface Action {
  id: string;
  manche: number;
  num_joueur: number;
  position_souhaitee: number | null;
  slot_attaque: number | null;
  attaque1: string | null;
  attaque2: string | null;
  slot_protection: number | null;
  protection_objet: string | null;
  created_at: string;
}

interface PositionFinale {
  id: string;
  manche: number;
  num_joueur: number;
  nom: string | null;
  clan: string | null;
  mise: number | null;
  rang_priorite: number | null;
  position_souhaitee: number | null;
  position_finale: number | null;
  attaque1: string | null;
  attaque2: string | null;
  protection: string | null;
  slot_attaque: number | null;
  slot_protection: number | null;
  created_at: string | null;
}

interface ActionWithPlayer extends Action {
  playerName: string;
  playerClan: string | null;
}

export function MJPhase2Tab({ game, onGameUpdate }: MJPhase2TabProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allActions, setAllActions] = useState<Action[]>([]);
  const [allPositions, setAllPositions] = useState<PositionFinale[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedManche, setSelectedManche] = useState<string>('current');
  const [availableManches, setAvailableManches] = useState<number[]>([]);
  const [combatResolved, setCombatResolved] = useState(false);

  const fetchData = useCallback(async () => {
    const [playersResult, actionsResult, positionsResult, combatResult] = await Promise.all([
      supabase
        .from('game_players')
        .select('id, player_number, display_name, clan')
        .eq('game_id', game.id)
        .eq('is_host', false)
        .in('status', ['ACTIVE', 'IN_GAME'])
        .order('player_number', { ascending: true }),
      supabase
        .from('actions')
        .select('*')
        .eq('game_id', game.id)
        .order('manche', { ascending: true })
        .order('num_joueur', { ascending: true }),
      supabase
        .from('positions_finales')
        .select('*')
        .eq('game_id', game.id)
        .order('manche', { ascending: true })
        .order('position_finale', { ascending: true }),
      supabase
        .from('combat_results')
        .select('id')
        .eq('game_id', game.id)
        .eq('manche', game.manche_active)
        .maybeSingle(),
    ]);

    if (playersResult.data) setPlayers(playersResult.data);
    if (actionsResult.data) {
      setAllActions(actionsResult.data);
      const mancheSet = new Set(actionsResult.data.map(a => a.manche));
      mancheSet.add(game.manche_active);
      setAvailableManches(Array.from(mancheSet).sort((a, b) => a - b));
    }
    if (positionsResult.data) setAllPositions(positionsResult.data);
    setCombatResolved(!!combatResult.data);
    setLoading(false);
  }, [game.id, game.manche_active]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-phase2-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'actions', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions_finales', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'combat_results', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id, fetchData]);

  const handlePublishPositions = async () => {
    setActionLoading('publish_positions');
    try {
      const { data, error } = await supabase.functions.invoke('publish-positions', {
        body: { gameId: game.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de la publication des positions');
      }

      toast.success('Positions finales publiées !');
      onGameUpdate();
      fetchData();
    } catch (error: unknown) {
      console.error('Publish positions error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveCombat = async () => {
    setActionLoading('resolve_combat');
    try {
      const { data, error } = await supabase.functions.invoke('resolve-combat', {
        body: { gameId: game.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de la résolution du combat');
      }

      toast.success('Combat résolu ! Passage à la phase suivante.');
      onGameUpdate();
      fetchData();
    } catch (error: unknown) {
      console.error('Resolve combat error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  // Player map for lookups
  const playerMap = new Map<number, Player>();
  for (const player of players) {
    playerMap.set(player.player_number, player);
  }

  // Filter by selected manche
  const displayManche = selectedManche === 'current' 
    ? game.manche_active 
    : parseInt(selectedManche);

  const filteredActions = allActions.filter(a => a.manche === displayManche);
  const filteredPositions = allPositions.filter(p => p.manche === displayManche);

  // Enrich actions with player info
  const actionsWithPlayers: ActionWithPlayer[] = filteredActions.map(action => {
    const player = playerMap.get(action.num_joueur);
    return {
      ...action,
      playerName: player?.display_name || `Joueur ${action.num_joueur}`,
      playerClan: player?.clan || null,
    };
  });

  // Stats
  const isPhase2 = game.phase === 'PHASE2_POSITIONS';
  const positionsPublished = filteredPositions.length > 0 && displayManche === game.manche_active;
  const currentMancheActions = allActions.filter(a => a.manche === game.manche_active);
  const actionCount = currentMancheActions.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Users className="h-5 w-5 mx-auto mb-2 text-primary" />
          <div className="text-2xl font-bold">{players.length}</div>
          <div className="text-xs text-muted-foreground">Joueurs actifs</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <ClipboardList className="h-5 w-5 mx-auto mb-2 text-blue-500" />
          <div className="text-2xl font-bold">{actionCount}</div>
          <div className="text-xs text-muted-foreground">Actions soumises (manche {game.manche_active})</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Target className="h-5 w-5 mx-auto mb-2 text-amber-500" />
          <div className="text-2xl font-bold">{positionsPublished ? 'Oui' : 'Non'}</div>
          <div className="text-xs text-muted-foreground">Positions publiées</div>
        </div>
        <div className="card-gradient rounded-lg border border-border p-4 text-center">
          <Swords className="h-5 w-5 mx-auto mb-2 text-red-500" />
          <div className="text-2xl font-bold">{combatResolved ? 'Oui' : 'Non'}</div>
          <div className="text-xs text-muted-foreground">Combat résolu</div>
        </div>
      </div>

      {/* Phase 2 Controls */}
      <div className="card-gradient rounded-lg border border-amber-500/30 p-4">
        <h3 className="font-display flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-amber-500" />
          Contrôles Phase 2
        </h3>
        
        <div className="flex flex-wrap gap-3 mb-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <ForestButton
                    onClick={handlePublishPositions}
                    disabled={actionLoading !== null || positionsPublished || !isPhase2}
                    className={positionsPublished ? 'opacity-50' : 'bg-blue-600 hover:bg-blue-700'}
                  >
                    {actionLoading === 'publish_positions' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : positionsPublished ? (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    ) : (
                      <Target className="h-4 w-4 mr-2" />
                    )}
                    {positionsPublished ? 'Positions publiées ✓' : '1. Calcul de priorité (positions finales)'}
                  </ForestButton>
                </span>
              </TooltipTrigger>
              {!isPhase2 && (
                <TooltipContent>
                  <p>Disponible uniquement en Phase 2</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <ForestButton
                    onClick={handleResolveCombat}
                    disabled={actionLoading !== null || !positionsPublished || combatResolved || !isPhase2}
                    className={combatResolved ? 'opacity-50' : 'bg-red-600 hover:bg-red-700'}
                  >
                    {actionLoading === 'resolve_combat' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : combatResolved ? (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    ) : (
                      <Swords className="h-4 w-4 mr-2" />
                    )}
                    {combatResolved ? 'Combat résolu ✓' : '2. Résolution des combats'}
                  </ForestButton>
                </span>
              </TooltipTrigger>
              {!isPhase2 && (
                <TooltipContent>
                  <p>Disponible uniquement en Phase 2</p>
                </TooltipContent>
              )}
              {!positionsPublished && isPhase2 && (
                <TooltipContent>
                  <p>Publiez d'abord les positions finales</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {!positionsPublished && isPhase2 && (
          <p className="text-xs text-muted-foreground">
            Étape 1 : Publiez les positions finales pour verrouiller la phase et établir l'ordre d'attaque.
          </p>
        )}
        {positionsPublished && !combatResolved && isPhase2 && (
          <p className="text-xs text-amber-400">
            Étape 2 : Résolvez le combat pour appliquer les dégâts et passer à la phase suivante.
          </p>
        )}
      </div>

      {/* Manche filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Afficher manche :</span>
        <Select value={selectedManche} onValueChange={setSelectedManche}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">
              Manche {game.manche_active} (actuelle)
            </SelectItem>
            {availableManches
              .filter(m => m !== game.manche_active)
              .map((m) => (
                <SelectItem key={m} value={String(m)}>
                  Manche {m}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sub-tabs for Actions vs Positions */}
      <Tabs defaultValue="actions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Actions joueurs ({filteredActions.length})
          </TabsTrigger>
          <TabsTrigger value="positions" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Positions finales ({filteredPositions.length})
          </TabsTrigger>
        </TabsList>

        {/* Actions Table */}
        <TabsContent value="actions" className="mt-4">
          <div className="card-gradient rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Manche</TableHead>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead className="text-center">Pos. souhaitée</TableHead>
                    <TableHead className="text-center">Slot Att.</TableHead>
                    <TableHead>Attaque 1</TableHead>
                    <TableHead>Attaque 2</TableHead>
                    <TableHead className="text-center">Slot Prot.</TableHead>
                    <TableHead>Protection</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionsWithPlayers.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="font-mono text-center">{action.manche}</TableCell>
                      <TableCell className="font-mono font-bold">P{action.num_joueur}</TableCell>
                      <TableCell className="font-medium">{action.playerName}</TableCell>
                      <TableCell className="text-center">
                        {action.position_souhaitee ? (
                          <Badge variant="outline">{action.position_souhaitee}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {action.slot_attaque ? (
                          <Badge variant="destructive" className="text-xs">{action.slot_attaque}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{action.attaque1 || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{action.attaque2 || '-'}</TableCell>
                      <TableCell className="text-center">
                        {action.slot_protection ? (
                          <Badge variant="secondary" className="text-xs">{action.slot_protection}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{action.protection_objet || '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {action.created_at ? format(new Date(action.created_at), 'HH:mm:ss', { locale: fr }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {actionsWithPlayers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        Aucune action pour cette manche
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Positions Table */}
        <TabsContent value="positions" className="mt-4">
          <div className="card-gradient rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Manche</TableHead>
                    <TableHead className="w-12">Pos.</TableHead>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Clan</TableHead>
                    <TableHead className="text-right">Mise</TableHead>
                    <TableHead className="text-center">Rang prio.</TableHead>
                    <TableHead className="text-center">Pos. souh.</TableHead>
                    <TableHead className="text-center">Slot Att.</TableHead>
                    <TableHead>Attaque 1</TableHead>
                    <TableHead>Attaque 2</TableHead>
                    <TableHead className="text-center">Slot Prot.</TableHead>
                    <TableHead>Protection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPositions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-mono text-center">{pos.manche}</TableCell>
                      <TableCell className="font-bold text-primary">#{pos.position_finale}</TableCell>
                      <TableCell className="font-mono font-bold">P{pos.num_joueur}</TableCell>
                      <TableCell className="font-medium">{pos.nom || `Joueur ${pos.num_joueur}`}</TableCell>
                      <TableCell className="text-muted-foreground">{pos.clan || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{pos.mise ?? '-'}</TableCell>
                      <TableCell className="text-center">
                        {pos.rang_priorite ? (
                          <Badge variant="outline">#{pos.rang_priorite}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {pos.position_souhaitee ? (
                          <Badge variant="outline">{pos.position_souhaitee}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {pos.slot_attaque ? (
                          <Badge variant="destructive" className="text-xs">{pos.slot_attaque}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{pos.attaque1 || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{pos.attaque2 || '-'}</TableCell>
                      <TableCell className="text-center">
                        {pos.slot_protection ? (
                          <Badge variant="secondary" className="text-xs">{pos.slot_protection}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{pos.protection || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {filteredPositions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        Aucune position finale pour cette manche
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Info note */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Cet onglet affiche les actions et positions finales de toutes les manches. 
          Les boutons de contrôle ne sont actifs qu'en Phase 2. Consultez les manches 
          passées en lecture seule via le filtre.
        </p>
      </div>
    </div>
  );
}
