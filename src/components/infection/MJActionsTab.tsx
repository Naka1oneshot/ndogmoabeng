import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Vote, Crosshair, Clock, Bot, CheckCircle, XCircle } from 'lucide-react';
import { INFECTION_ROLE_LABELS, getInfectionThemeClasses } from './InfectionTheme';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  role_code: string | null;
  is_alive: boolean | null;
}

interface InfectionInput {
  id: string;
  player_id: string;
  player_num: number;
  manche: number;
  pv_shot_target_num: number | null;
  pv_antidote_target_num: number | null;
  pv_patient0_target_num: number | null;
  ba_shot_target_num: number | null;
  sy_research_target_num: number | null;
  oc_lookup_target_num: number | null;
  ae_sabotage_target_num: number | null;
  corruption_amount: number | null;
  vote_test_target_num: number | null;
  vote_suspect_pv_target_num: number | null;
  updated_at: string | null;
}

interface InfectionShot {
  id: string;
  shooter_num: number;
  shooter_role: string;
  target_num: number;
  status: string;
  server_ts: string;
  manche: number;
}

interface BotDecisionLog {
  id: string;
  manche: number;
  timestamp: string;
  details: string;
}

interface BotDecisionResult {
  player_number: number;
  display_name: string;
  role_code: string;
  action?: string;
  target?: number;
  amount?: number;
  skipped_reason?: string;
}

interface MJActionsTabProps {
  gameId: string;
  sessionGameId: string;
  manche: number;
  players: Player[];
}

export function MJActionsTab({ gameId, sessionGameId, manche, players }: MJActionsTabProps) {
  const theme = getInfectionThemeClasses();
  const [inputs, setInputs] = useState<InfectionInput[]>([]);
  const [shots, setShots] = useState<InfectionShot[]>([]);
  const [botLogs, setBotLogs] = useState<BotDecisionLog[]>([]);
  const [subTab, setSubTab] = useState('roles');

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-actions-${sessionGameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_inputs', filter: `session_game_id=eq.${sessionGameId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_shots', filter: `session_game_id=eq.${sessionGameId}` }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs_mj', filter: `game_id=eq.${gameId}` }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId, manche, gameId]);

  const fetchData = async () => {
    const [{ data: inputsData }, { data: shotsData }, { data: logsData }] = await Promise.all([
      supabase
        .from('infection_inputs')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .eq('manche', manche),
      supabase
        .from('infection_shots')
        .select('*')
        .eq('session_game_id', sessionGameId)
        .eq('manche', manche)
        .order('server_ts', { ascending: true }),
      supabase
        .from('logs_mj')
        .select('id, manche, timestamp, details')
        .eq('game_id', gameId)
        .eq('action', 'BOT_DECISIONS')
        .order('timestamp', { ascending: false })
        .limit(20),
    ]);

    if (inputsData) setInputs(inputsData);
    if (shotsData) setShots(shotsData);
    if (logsData) setBotLogs(logsData as BotDecisionLog[]);
  };

  const parseBotDecisions = (details: string): { bots_processed: number; inputs_created: number; shots_created: number; results: BotDecisionResult[] } | null => {
    try {
      return JSON.parse(details);
    } catch {
      return null;
    }
  };

  const getPlayerName = (num: number | null) => {
    if (!num) return '—';
    const p = players.find(pl => pl.player_number === num);
    return p ? `#${num} ${p.display_name}` : `#${num}`;
  };

  const getPlayerByNum = (num: number) => players.find(p => p.player_number === num);

  // Group inputs by role
  const pvPlayers = players.filter(p => p.role_code === 'PV');
  const baPlayer = players.find(p => p.role_code === 'BA');
  const syPlayers = players.filter(p => p.role_code === 'SY');
  const ocPlayer = players.find(p => p.role_code === 'OC');
  const aePlayers = players.filter(p => p.role_code === 'AE');

  const getInputForPlayer = (num: number) => inputs.find(i => i.player_num === num);

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full bg-[#121A2B] border-b border-[#2D3748] rounded-none">
          <TabsTrigger value="roles" className="flex-1 data-[state=active]:bg-[#1A2235] text-xs sm:text-sm">
            Par rôle
          </TabsTrigger>
          <TabsTrigger value="shots" className="flex-1 data-[state=active]:bg-[#1A2235] text-xs sm:text-sm">
            <Crosshair className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Tirs</span> ({shots.length})
          </TabsTrigger>
          <TabsTrigger value="votes" className="flex-1 data-[state=active]:bg-[#1A2235] text-xs sm:text-sm">
            <Vote className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Votes</span>
          </TabsTrigger>
          <TabsTrigger value="bots" className="flex-1 data-[state=active]:bg-[#1A2235] text-xs sm:text-sm">
            <Bot className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Bots</span> ({botLogs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4 space-y-4">
          {/* PV Actions */}
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#B00020]" />
              <span className="font-semibold">Porteurs du Virus ({pvPlayers.length})</span>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {pvPlayers.map(p => {
                const input = getInputForPlayer(p.player_number!);
                return (
                  <div key={p.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                        #{p.player_number} {p.display_name}
                      </span>
                      {input?.updated_at && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Modifié
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#9CA3AF]">
                      <div>🎯 Tir: <span className="text-white">{getPlayerName(input?.pv_shot_target_num ?? null)}</span></div>
                      <div>💉 Antidote: <span className="text-white">{getPlayerName(input?.pv_antidote_target_num ?? null)}</span></div>
                      {manche === 1 && (
                        <div className="col-span-2">🦠 Patient 0: <span className="text-[#B00020]">{getPlayerName(input?.pv_patient0_target_num ?? null)}</span></div>
                      )}
                    </div>
                  </div>
                );
              })}
              {pvPlayers.length === 0 && (
                <div className="p-4 text-center text-[#6B7280]">Aucun PV</div>
              )}
            </div>
          </div>

          {/* BA Actions */}
          {baPlayer && (
            <div className={theme.card}>
              <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#6B21A8]" />
                <span className="font-semibold">Bras Armé</span>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className={baPlayer.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                    #{baPlayer.player_number} {baPlayer.display_name}
                  </span>
                </div>
                {(() => {
                  const input = getInputForPlayer(baPlayer.player_number!);
                  return (
                    <div className="mt-2 text-xs text-[#9CA3AF]">
                      🎯 Tir: <span className="text-white">{getPlayerName(input?.ba_shot_target_num ?? null)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* SY Actions */}
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#2AB3A6]" />
              <span className="font-semibold">Syndicat ({syPlayers.length})</span>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {syPlayers.map(p => {
                const input = getInputForPlayer(p.player_number!);
                return (
                  <div key={p.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                        #{p.player_number} {p.display_name}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-[#9CA3AF]">
                      🔬 Recherche: <span className="text-[#2AB3A6]">{getPlayerName(input?.sy_research_target_num ?? null)}</span>
                    </div>
                  </div>
                );
              })}
              {syPlayers.length === 0 && (
                <div className="p-4 text-center text-[#6B7280]">Aucun SY</div>
              )}
            </div>
          </div>

          {/* OC Actions */}
          {ocPlayer && (
            <div className={theme.card}>
              <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#E6A23C]" />
                <span className="font-semibold">Oracle</span>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className={ocPlayer.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                    #{ocPlayer.player_number} {ocPlayer.display_name}
                  </span>
                </div>
                {(() => {
                  const input = getInputForPlayer(ocPlayer.player_number!);
                  return (
                    <div className="mt-2 text-xs text-[#9CA3AF]">
                      🔮 Consultation: <span className="text-[#E6A23C]">{getPlayerName(input?.oc_lookup_target_num ?? null)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* AE Actions */}
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
              <span className="font-semibold">Agents Ezkar ({aePlayers.length})</span>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {aePlayers.map(p => {
                const input = getInputForPlayer(p.player_number!);
                return (
                  <div key={p.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                        #{p.player_number} {p.display_name}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#9CA3AF]">
                      <div>🎯 Sabotage: <span className="text-white">{getPlayerName(input?.ae_sabotage_target_num ?? null)}</span></div>
                      <div>💰 Corruption: <span className="text-[#D4AF37]">{input?.corruption_amount ?? 0} jetons</span></div>
                    </div>
                  </div>
                );
              })}
              {aePlayers.length === 0 && (
                <div className="p-4 text-center text-[#6B7280]">Aucun AE</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="shots" className="mt-4">
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748]">
              <span className="font-semibold">Historique des tirs (ordre serveur)</span>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {shots.length === 0 ? (
                <div className="p-4 text-center text-[#6B7280]">Aucun tir enregistré</div>
              ) : (
                shots.map((shot, idx) => {
                  const roleInfo = INFECTION_ROLE_LABELS[shot.shooter_role];
                  return (
                    <div key={shot.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[#6B7280] font-mono text-xs">#{idx + 1}</span>
                        <Badge style={{ backgroundColor: `${roleInfo?.color || '#666'}20`, color: roleInfo?.color || '#666' }}>
                          {roleInfo?.short || shot.shooter_role}
                        </Badge>
                        <span>{getPlayerName(shot.shooter_num)}</span>
                        <span className="text-[#6B7280]">→</span>
                        <span className="text-[#B00020]">{getPlayerName(shot.target_num)}</span>
                      </div>
                      <Badge variant={shot.status === 'PENDING' ? 'outline' : shot.status === 'APPLIED' ? 'default' : 'secondary'}>
                        {shot.status}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="votes" className="mt-4 space-y-4">
          {/* Vote test anticorps */}
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748]">
              <span className="font-semibold">Vote test anticorps</span>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {inputs.filter(i => i.vote_test_target_num).length === 0 ? (
                <div className="p-4 text-center text-[#6B7280]">Aucun vote</div>
              ) : (
                (() => {
                  const voteCounts: Record<number, number> = {};
                  inputs.forEach(i => {
                    if (i.vote_test_target_num) {
                      voteCounts[i.vote_test_target_num] = (voteCounts[i.vote_test_target_num] || 0) + 1;
                    }
                  });
                  const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
                  return sorted.map(([num, count]) => (
                    <div key={num} className="p-3 flex items-center justify-between">
                      <span>{getPlayerName(parseInt(num))}</span>
                      <Badge className="bg-[#D4AF37]/20 text-[#D4AF37]">{count} vote{count > 1 ? 's' : ''}</Badge>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>

          {/* Vote suspect PV */}
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748]">
              <span className="font-semibold">Vote suspect PV (Citoyens)</span>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {inputs.filter(i => i.vote_suspect_pv_target_num).length === 0 ? (
                <div className="p-4 text-center text-[#6B7280]">Aucun vote</div>
              ) : (
                (() => {
                  const voteCounts: Record<number, number> = {};
                  inputs.forEach(i => {
                    if (i.vote_suspect_pv_target_num) {
                      voteCounts[i.vote_suspect_pv_target_num] = (voteCounts[i.vote_suspect_pv_target_num] || 0) + 1;
                    }
                  });
                  const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
                  return sorted.map(([num, count]) => (
                    <div key={num} className="p-3 flex items-center justify-between">
                      <span>{getPlayerName(parseInt(num))}</span>
                      <Badge className="bg-[#B00020]/20 text-[#B00020]">{count} vote{count > 1 ? 's' : ''}</Badge>
                    </div>
                  ));
                })()
              )}
            </div>
          </div>
        </TabsContent>

        {/* Bot Decisions History */}
        <TabsContent value="bots" className="mt-4 space-y-4">
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748]">
              <span className="font-semibold">Historique des décisions bots</span>
            </div>
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y divide-[#2D3748]">
                {botLogs.length === 0 ? (
                  <div className="p-4 text-center text-[#6B7280]">
                    Aucune décision de bot enregistrée
                  </div>
                ) : (
                  botLogs.map(log => {
                    const parsed = parseBotDecisions(log.details);
                    const logManche = log.manche;
                    const isCurrentManche = logManche === manche;
                    
                    return (
                      <div key={log.id} className={`p-3 ${isCurrentManche ? 'bg-[#D4AF37]/5' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={isCurrentManche ? 'default' : 'outline'} className={isCurrentManche ? 'bg-[#D4AF37] text-black' : ''}>
                              M.{logManche}
                            </Badge>
                            <span className="text-xs text-[#6B7280]">
                              {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                            </span>
                          </div>
                          {parsed && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[#2AB3A6]">{parsed.inputs_created + parsed.shots_created} actions</span>
                              <span className="text-[#6B7280]">/</span>
                              <span className="text-[#9CA3AF]">{parsed.bots_processed} bots</span>
                            </div>
                          )}
                        </div>
                        
                        {parsed?.results && parsed.results.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {parsed.results.map((result, idx) => {
                              const roleInfo = INFECTION_ROLE_LABELS[result.role_code];
                              const hasAction = !!result.action;
                              
                              return (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  {hasAction ? (
                                    <CheckCircle className="h-3 w-3 text-[#2AB3A6] shrink-0" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-[#6B7280] shrink-0" />
                                  )}
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs px-1 py-0"
                                    style={{ 
                                      borderColor: roleInfo?.color || '#666', 
                                      color: roleInfo?.color || '#666' 
                                    }}
                                  >
                                    {roleInfo?.short || result.role_code}
                                  </Badge>
                                  <span className={hasAction ? 'text-white' : 'text-[#6B7280]'}>
                                    #{result.player_number} {result.display_name}
                                  </span>
                                  {hasAction ? (
                                    <span className="text-[#D4AF37]">
                                      → {result.action}
                                      {result.target && ` (${getPlayerName(result.target)})`}
                                      {result.amount && ` [${result.amount}j]`}
                                    </span>
                                  ) : (
                                    <span className="text-[#6B7280] italic truncate max-w-[150px]">
                                      {result.skipped_reason}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
