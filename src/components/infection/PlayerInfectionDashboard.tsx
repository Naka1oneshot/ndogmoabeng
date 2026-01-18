import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Target, MessageSquare, Package, Activity, 
  Syringe, Users, Vote, Skull, Shield
} from 'lucide-react';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS, getInfectionThemeClasses } from './InfectionTheme';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  status: string;
  manche_active: number | null;
  phase: string;
  current_session_game_id: string | null;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  jetons: number | null;
  pvic: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  team_code: string | null;
  immune_permanent: boolean | null;
  // Note: is_carrier, is_contagious are NOT visible to players
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
}

interface PlayerInfectionDashboardProps {
  game: Game;
  player: Player;
  onLeave?: () => void;
}

export function PlayerInfectionDashboard({ game, player, onLeave }: PlayerInfectionDashboardProps) {
  const theme = getInfectionThemeClasses();
  
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState('actions');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`infection-player-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_round_state', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const fetchData = async () => {
    // Fetch all players (for targeting)
    const { data: playersData } = await supabase
      .from('game_players')
      .select('id, display_name, player_number, clan, is_alive')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .order('player_number', { ascending: true });

    if (playersData) {
      setAllPlayers(playersData as Player[]);
    }

    // Fetch current round state
    if (game.current_session_game_id && game.manche_active) {
      const { data: roundData } = await supabase
        .from('infection_round_state')
        .select('id, manche, status')
        .eq('session_game_id', game.current_session_game_id)
        .eq('manche', game.manche_active)
        .maybeSingle();

      if (roundData) {
        setRoundState(roundData as RoundState);
      }
    }

    setLoading(false);
  };

  const roleInfo = player.role_code ? INFECTION_ROLE_LABELS[player.role_code] : null;
  const alivePlayers = allPlayers.filter(p => p.is_alive !== false);
  const isLocked = roundState?.status !== 'OPEN';

  // Lobby waiting screen
  if (game.status === 'LOBBY') {
    return (
      <div className={theme.container}>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <Syringe className="h-16 w-16 text-[#D4AF37] mb-6 animate-pulse" />
          <h1 className="text-2xl font-bold text-[#D4AF37] mb-2">
            Infection à Ndogmoabeng
          </h1>
          <p className="text-[#9CA3AF] mb-4">
            En attente du lancement de la partie...
          </p>
          <div className={theme.card + ' p-4'}>
            <p className="text-sm text-[#6B7280]">
              Vous êtes connecté en tant que
            </p>
            <p className="text-lg font-bold mt-1">{player.display_name}</p>
            {player.clan && (
              <Badge variant="outline" className="mt-2">{player.clan}</Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dead player view
  if (player.is_alive === false) {
    return (
      <div className={theme.container}>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <Skull className="h-16 w-16 text-[#B00020] mb-6" />
          <h1 className="text-2xl font-bold text-[#B00020] mb-2">
            Vous êtes mort
          </h1>
          <p className="text-[#9CA3AF] mb-4">
            Vous pouvez continuer à observer la partie.
          </p>
          {roleInfo && (
            <Badge 
              className="text-lg px-4 py-2"
              style={{ 
                backgroundColor: `${roleInfo.color}20`,
                color: roleInfo.color,
                borderColor: `${roleInfo.color}50`
              }}
            >
              Vous étiez: {roleInfo.name}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme.container} flex flex-col`}>
      {/* Header */}
      <div className={`${theme.header} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#D4AF37]">
              Manche {game.manche_active || 1}
            </h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#9CA3AF]">{player.display_name}</span>
              {roleInfo && (
                <Badge 
                  style={{ 
                    backgroundColor: `${roleInfo.color}20`,
                    color: roleInfo.color,
                    borderColor: `${roleInfo.color}50`
                  }}
                >
                  {roleInfo.name}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#1A2235] border-[#D4AF37]/30 text-[#D4AF37]">
              💰 {player.jetons || 0}
            </Badge>
            <Badge className="bg-[#1A2235] border-[#2AB3A6]/30 text-[#2AB3A6]">
              ⭐ {player.pvic || 0}
            </Badge>
          </div>
        </div>
        {roundState && (
          <div className="mt-2">
            <Badge 
              className={
                roundState.status === 'OPEN' ? 'bg-[#2AB3A6]/20 text-[#2AB3A6]' :
                roundState.status === 'LOCKED' ? 'bg-[#E6A23C]/20 text-[#E6A23C]' :
                'bg-[#6B7280]/20 text-[#6B7280]'
              }
            >
              {roundState.status === 'OPEN' ? '🟢 Actions ouvertes' :
               roundState.status === 'LOCKED' ? '🔒 Résolution en cours' :
               '✅ Manche terminée'}
            </Badge>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full bg-[#121A2B] border-b border-[#2D3748] rounded-none p-0 h-auto">
          <TabsTrigger value="actions" className="flex-1 py-3 data-[state=active]:bg-[#1A2235]">
            <Target className="h-4 w-4" />
            <span className="sr-only md:not-sr-only md:ml-1">Actions</span>
          </TabsTrigger>
          <TabsTrigger value="votes" className="flex-1 py-3 data-[state=active]:bg-[#1A2235]">
            <Vote className="h-4 w-4" />
            <span className="sr-only md:not-sr-only md:ml-1">Votes</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 py-3 data-[state=active]:bg-[#1A2235]">
            <MessageSquare className="h-4 w-4" />
            <span className="sr-only md:not-sr-only md:ml-1">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex-1 py-3 data-[state=active]:bg-[#1A2235]">
            <Package className="h-4 w-4" />
            <span className="sr-only md:not-sr-only md:ml-1">Inventaire</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-1 py-3 data-[state=active]:bg-[#1A2235]">
            <Activity className="h-4 w-4" />
            <span className="sr-only md:not-sr-only md:ml-1">Events</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="flex-1 p-4 mt-0 overflow-auto">
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-[#D4AF37]" />
                Actions de rôle
              </h2>
            </div>
            <div className="p-4">
              {isLocked ? (
                <p className="text-center text-[#6B7280] py-8">
                  Les actions sont verrouillées pour cette manche.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Role-specific actions will go here */}
                  {player.role_code === 'BA' && (
                    <div className="p-4 bg-[#1A2235] rounded-lg">
                      <h3 className="font-semibold text-[#B00020] mb-2">
                        Bras Armé — Tirer
                      </h3>
                      <p className="text-sm text-[#6B7280] mb-4">
                        Choisissez une cible à éliminer (1 tir par manche max).
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        (Interface de sélection à implémenter)
                      </p>
                    </div>
                  )}
                  {player.role_code === 'PV' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-[#1A2235] rounded-lg">
                        <h3 className="font-semibold text-[#B00020] mb-2">
                          Porteur de Virus — Patient 0
                        </h3>
                        <p className="text-sm text-[#6B7280]">
                          {game.manche_active === 1 
                            ? 'Choisissez votre première victime (obligatoire manche 1).'
                            : 'Patient 0 déjà désigné.'}
                        </p>
                      </div>
                    </div>
                  )}
                  {player.role_code === 'SY' && (
                    <div className="p-4 bg-[#1A2235] rounded-lg">
                      <h3 className="font-semibold text-[#2AB3A6] mb-2">
                        Scientifique — Recherche
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        Choisissez qui tester pour les anticorps.
                      </p>
                    </div>
                  )}
                  {player.role_code === 'OC' && (
                    <div className="p-4 bg-[#1A2235] rounded-lg">
                      <h3 className="font-semibold text-[#D4AF37] mb-2">
                        Oracle — Consultation
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        Révélez le rôle d'un joueur (1 fois par manche).
                      </p>
                    </div>
                  )}
                  {player.role_code === 'AE' && (
                    <div className="p-4 bg-[#1A2235] rounded-lg">
                      <h3 className="font-semibold text-[#D4AF37] mb-2">
                        Agent Ennemi — Sabotage
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        Identifiez le Bras Armé pour activer la corruption.
                      </p>
                    </div>
                  )}
                  {(player.role_code === 'CV' || player.role_code === 'KK') && (
                    <div className="p-4 bg-[#1A2235] rounded-lg">
                      <h3 className="font-semibold text-[#6B7280] mb-2">
                        Citoyen
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        Aucune action spéciale. Participez aux votes et à la corruption.
                      </p>
                    </div>
                  )}

                  {/* Corruption input for everyone */}
                  <div className="p-4 bg-[#1A2235] rounded-lg border border-[#D4AF37]/30">
                    <h3 className="font-semibold text-[#D4AF37] mb-2">
                      💰 Corruption
                    </h3>
                    <p className="text-sm text-[#6B7280] mb-4">
                      Misez des jetons pour influencer le sabotage du BA.
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      (Input de mise à implémenter)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="votes" className="flex-1 p-4 mt-0 overflow-auto">
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold">Votes de la manche</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-4 bg-[#1A2235] rounded-lg">
                <h3 className="font-semibold mb-2">🧪 Test anticorps</h3>
                <p className="text-sm text-[#6B7280]">
                  Votez pour qui devrait être testé.
                </p>
              </div>
              <div className="p-4 bg-[#1A2235] rounded-lg">
                <h3 className="font-semibold mb-2">🔍 Soupçon PV</h3>
                <p className="text-sm text-[#6B7280]">
                  Qui pensez-vous être un Porteur de Virus ?
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="chat" className="flex-1 p-4 mt-0 overflow-auto">
          <div className={theme.card + ' h-full'}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold">Chat</h2>
            </div>
            <div className="p-4 text-center text-[#6B7280]">
              Chat public et privés (à implémenter)
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inventory" className="flex-1 p-4 mt-0 overflow-auto">
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-[#D4AF37]" />
                Inventaire
              </h2>
            </div>
            <div className="p-4">
              <p className="text-center text-[#6B7280] py-8">
                Votre inventaire (à implémenter)
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="events" className="flex-1 p-4 mt-0 overflow-auto">
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#D4AF37]" />
                Événements
              </h2>
            </div>
            <div className="p-4">
              <p className="text-center text-[#6B7280] py-8">
                Feed d'événements (à implémenter)
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
