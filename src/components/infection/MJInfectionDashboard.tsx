import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Users, Syringe, Target, MessageSquare, 
  Activity, Play, Lock, CheckCircle, Settings, Skull
} from 'lucide-react';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS, getInfectionThemeClasses } from './InfectionTheme';
import { toast } from 'sonner';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number | null;
  phase: string;
  starting_tokens: number;
  current_session_game_id: string | null;
  selected_game_type_code: string | null;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  status: string | null;
  jetons: number | null;
  pvic: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  team_code: string | null;
  is_carrier: boolean | null;
  is_contagious: boolean | null;
  immune_permanent: boolean | null;
  infected_at_manche: number | null;
  will_contaminate_at_manche: number | null;
  will_die_at_manche: number | null;
  has_antibodies: boolean | null;
  last_seen: string | null;
}

interface RoundState {
  id: string;
  manche: number;
  status: string;
  sy_success_count: number;
  sy_required_success: number;
}

interface MJInfectionDashboardProps {
  game: Game;
  onBack: () => void;
}

export function MJInfectionDashboard({ game, onBack }: MJInfectionDashboardProps) {
  const navigate = useNavigate();
  const theme = getInfectionThemeClasses();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('control');

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`infection-mj-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${game.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_round_state', filter: `game_id=eq.${game.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game.id]);

  const fetchData = async () => {
    // Fetch players
    const { data: playersData } = await supabase
      .from('game_players')
      .select('*')
      .eq('game_id', game.id)
      .is('removed_at', null)
      .order('player_number', { ascending: true });

    if (playersData) {
      setPlayers(playersData as Player[]);
    }

    // Fetch current round state
    if (game.current_session_game_id && game.manche_active) {
      const { data: roundData } = await supabase
        .from('infection_round_state')
        .select('*')
        .eq('session_game_id', game.current_session_game_id)
        .eq('manche', game.manche_active)
        .maybeSingle();

      if (roundData) {
        setRoundState(roundData as RoundState);
      }
    }

    setLoading(false);
  };

  const handleStartGame = async () => {
    toast.info('Lancement de la partie INFECTION...');
    // TODO: Call start-infection edge function
    toast.success('Partie lancée ! (à implémenter)');
  };

  const handleLockAndResolve = async () => {
    if (!roundState) return;
    toast.info('Verrouillage et résolution...');
    // TODO: Call resolve-infection-round edge function
    toast.success('Manche résolue ! (à implémenter)');
  };

  const handleNextRound = async () => {
    toast.info('Ouverture de la manche suivante...');
    // TODO: Call next-infection-round edge function
    toast.success('Manche suivante ouverte ! (à implémenter)');
  };

  const activePlayers = players.filter(p => p.status === 'ACTIVE');
  const alivePlayers = activePlayers.filter(p => p.is_alive !== false);

  // Lobby view
  if (game.status === 'LOBBY') {
    return (
      <div className={theme.container}>
        <div className={`${theme.header} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-[#D4AF37]">{game.name}</h1>
                <p className="text-sm text-[#9CA3AF]">Code: {game.join_code}</p>
              </div>
            </div>
            <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30">
              <Syringe className="h-3 w-3 mr-1" />
              INFECTION
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Player list */}
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-[#D4AF37]" />
                Joueurs en attente ({activePlayers.length})
              </h2>
            </div>
            <div className="p-4">
              {activePlayers.length === 0 ? (
                <p className="text-[#6B7280] text-center py-8">
                  En attente de joueurs...
                </p>
              ) : (
                <div className="space-y-2">
                  {activePlayers.map((player, idx) => (
                    <div 
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-[#1A2235] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#D4AF37] font-mono">#{idx + 1}</span>
                        <span className="font-medium">{player.display_name}</span>
                        {player.clan && (
                          <Badge variant="outline" className="text-xs">
                            {player.clan}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Role configuration (placeholder) */}
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#D4AF37]" />
                Configuration des rôles
              </h2>
            </div>
            <div className="p-4">
              <p className="text-[#6B7280] text-sm mb-4">
                Composition par défaut selon le nombre de joueurs :
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(INFECTION_ROLE_LABELS).map(([code, info]) => (
                  <div key={code} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: info.color }}
                    />
                    <span>{info.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Start game button */}
          <Button 
            className={`w-full ${theme.button}`}
            size="lg"
            onClick={handleStartGame}
            disabled={activePlayers.length < 4}
          >
            <Play className="h-5 w-5 mr-2" />
            Lancer la partie ({activePlayers.length} joueurs)
          </Button>
          {activePlayers.length < 4 && (
            <p className="text-center text-[#6B7280] text-sm">
              Minimum 4 joueurs requis
            </p>
          )}
        </div>
      </div>
    );
  }

  // In-game view
  return (
    <div className={theme.container}>
      {/* Header */}
      <div className={`${theme.header} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-[#D4AF37]">{game.name}</h1>
              <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                <span>Manche {game.manche_active || 1}</span>
                {roundState && (
                  <Badge 
                    className={
                      roundState.status === 'OPEN' ? 'bg-[#2AB3A6]/20 text-[#2AB3A6]' :
                      roundState.status === 'LOCKED' ? 'bg-[#E6A23C]/20 text-[#E6A23C]' :
                      'bg-[#6B7280]/20 text-[#6B7280]'
                    }
                  >
                    {roundState.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6]">
              {alivePlayers.length} vivants
            </Badge>
            <Badge className="bg-[#B00020]/20 text-[#B00020]">
              <Skull className="h-3 w-3 mr-1" />
              {activePlayers.length - alivePlayers.length} morts
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full bg-[#121A2B] border-b border-[#2D3748] rounded-none p-0">
          <TabsTrigger value="control" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <Activity className="h-4 w-4 mr-1" />
            Contrôle
          </TabsTrigger>
          <TabsTrigger value="players" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <Users className="h-4 w-4 mr-1" />
            Joueurs
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <Target className="h-4 w-4 mr-1" />
            Actions
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 data-[state=active]:bg-[#1A2235]">
            <MessageSquare className="h-4 w-4 mr-1" />
            Chats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="p-4 space-y-4 mt-0">
          {/* Round control */}
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold">Contrôle de la manche</h2>
            </div>
            <div className="p-4 space-y-4">
              {roundState?.status === 'OPEN' && (
                <Button 
                  className={`w-full ${theme.buttonDanger}`}
                  onClick={handleLockAndResolve}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Verrouiller et Résoudre
                </Button>
              )}
              {roundState?.status === 'RESOLVED' && (
                <Button 
                  className={`w-full ${theme.button}`}
                  onClick={handleNextRound}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Ouvrir manche suivante
                </Button>
              )}
              {!roundState && (
                <p className="text-center text-[#6B7280]">
                  Aucune manche active
                </p>
              )}
            </div>
          </div>

          {/* SY Progress */}
          {roundState && (
            <div className={theme.card}>
              <div className="p-4 border-b border-[#2D3748]">
                <h2 className="font-semibold text-[#2AB3A6]">Progression SY</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span>Recherches réussies</span>
                  <span className="font-bold text-[#2AB3A6]">
                    {roundState.sy_success_count} / {roundState.sy_required_success}
                  </span>
                </div>
                <div className="h-2 bg-[#1A2235] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#2AB3A6] transition-all"
                    style={{ 
                      width: `${(roundState.sy_success_count / roundState.sy_required_success) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="players" className="p-4 mt-0">
          <div className={theme.card}>
            <div className="p-4 border-b border-[#2D3748]">
              <h2 className="font-semibold">Joueurs ({activePlayers.length})</h2>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {activePlayers.map(player => {
                const roleInfo = player.role_code ? INFECTION_ROLE_LABELS[player.role_code] : null;
                return (
                  <div key={player.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[#D4AF37] font-mono">
                          #{player.player_number}
                        </span>
                        <span className={player.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                          {player.display_name}
                        </span>
                        {roleInfo && (
                          <Badge 
                            style={{ 
                              backgroundColor: `${roleInfo.color}20`,
                              color: roleInfo.color,
                              borderColor: `${roleInfo.color}50`
                            }}
                          >
                            {roleInfo.short}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {player.is_carrier && (
                          <Badge className="bg-[#B00020]/20 text-[#B00020]">Porteur</Badge>
                        )}
                        {player.is_contagious && (
                          <Badge className="bg-[#E6A23C]/20 text-[#E6A23C]">Contagieux</Badge>
                        )}
                        {player.immune_permanent && (
                          <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6]">Immunisé</Badge>
                        )}
                        {player.has_antibodies && (
                          <Badge className="bg-[#D4AF37]/20 text-[#D4AF37]">Anticorps</Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-[#6B7280]">
                      <span>💰 {player.jetons || 0} jetons</span>
                      <span>⭐ {player.pvic || 0} PVic</span>
                      {player.infected_at_manche && (
                        <span className="text-[#B00020]">
                          Infecté M{player.infected_at_manche}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="p-4 mt-0">
          <div className={theme.card}>
            <div className="p-4 text-center text-[#6B7280]">
              Actions et votes de la manche (à implémenter)
            </div>
          </div>
        </TabsContent>

        <TabsContent value="chat" className="p-4 mt-0">
          <div className={theme.card}>
            <div className="p-4 text-center text-[#6B7280]">
              Chats PUBLIC / PV / SY (à implémenter)
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
