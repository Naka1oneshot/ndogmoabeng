import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Vote, Crosshair, Clock, Bot, CheckCircle, XCircle, Shield, Syringe, Zap } from 'lucide-react';
import { INFECTION_ROLE_LABELS, getInfectionThemeClasses } from './InfectionTheme';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  role_code: string | null;
  is_alive: boolean | null;
  is_bot?: boolean;
  has_antibodies?: boolean | null;
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
  ignore_reason: string | null;
  server_ts: string;
  manche: number;
}

interface InventoryItem {
  owner_num: number;
  objet: string;
  quantite: number;
  disponible: boolean;
  dispo_attaque: boolean;
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
  protected_by_gilet?: boolean;
  corruption_paid?: number;
}

interface MJActionsTabProps {
  gameId: string;
  sessionGameId: string;
  manche: number;
  players: Player[];
}

// Capacity indicator component
function CapacityBadge({ available, total, icon, label, color }: { 
  available: number; 
  total: number; 
  icon: React.ReactNode; 
  label: string;
  color: string;
}) {
  const isExhausted = available <= 0;
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${isExhausted ? 'bg-[#6B7280]/20 text-[#6B7280]' : `bg-[${color}]/20 text-[${color}]`}`}
         style={{ backgroundColor: isExhausted ? 'rgb(107 114 128 / 0.2)' : `${color}20`, color: isExhausted ? '#6B7280' : color }}>
      {icon}
      <span>{available}/{total}</span>
      <span className="hidden sm:inline ml-1">{label}</span>
      {isExhausted && <XCircle className="h-3 w-3 ml-1" />}
    </div>
  );
}

export function MJActionsTab({ gameId, sessionGameId, manche, players }: MJActionsTabProps) {
  const theme = getInfectionThemeClasses();
  const [inputs, setInputs] = useState<InfectionInput[]>([]);
  const [shots, setShots] = useState<InfectionShot[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [botLogs, setBotLogs] = useState<BotDecisionLog[]>([]);
  const [subTab, setSubTab] = useState('roles');

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`mj-actions-${sessionGameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_inputs', filter: `session_game_id=eq.${sessionGameId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infection_shots', filter: `session_game_id=eq.${sessionGameId}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory', filter: `session_game_id=eq.${sessionGameId}` }, fetchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs_mj', filter: `game_id=eq.${gameId}` }, fetchData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId, manche, gameId]);

  const fetchData = async () => {
    const [{ data: inputsData }, { data: shotsData }, { data: inventoryData }, { data: logsData }] = await Promise.all([
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
        .from('inventory')
        .select('owner_num, objet, quantite, disponible, dispo_attaque')
        .eq('session_game_id', sessionGameId)
        .in('objet', ['Balle PV', 'Balle BA', 'Antidote PV', 'Antidote Ezkar', 'Gilet']),
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
    if (inventoryData) setInventory(inventoryData as InventoryItem[]);
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
  
  // Get inventory for a player
  const getPlayerInventory = (playerNum: number) => {
    return inventory.filter(i => i.owner_num === playerNum);
  };
  
  // Get specific item count
  const getItemCount = (playerNum: number, itemName: string): { available: number; total: number } => {
    const item = inventory.find(i => i.owner_num === playerNum && i.objet === itemName);
    if (!item) return { available: 0, total: 0 };
    return { available: item.quantite || 0, total: 1 };
  };

  // Group inputs by role
  const pvPlayers = players.filter(p => p.role_code === 'PV');
  const baPlayer = players.find(p => p.role_code === 'BA');
  const syPlayers = players.filter(p => p.role_code === 'SY');
  const ocPlayer = players.find(p => p.role_code === 'OC');
  const aePlayers = players.filter(p => p.role_code === 'AE');
  const cvPlayers = players.filter(p => p.role_code === 'CV');
  const kkPlayers = players.filter(p => p.role_code === 'KK');
  
  // Find the CV with antibodies
  const antibodyCarrier = cvPlayers.find(p => p.has_antibodies === true);
  
  // Get all players with Ezkar protections
  const ezkarProtectedPlayers = players.filter(p => {
    const inv = getPlayerInventory(p.player_number!);
    return inv.some(i => i.objet === 'Gilet' && (i.quantite || 0) > 0);
  });

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
          {/* Ezkar Protections Summary */}
          {ezkarProtectedPlayers.length > 0 && (
            <div className="p-3 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-[#3B82F6]" />
                <span className="text-sm font-medium text-[#3B82F6]">Joueurs protégés (Gilet Ezkar)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ezkarProtectedPlayers.map(p => (
                  <Badge key={p.id} variant="outline" className="text-[#3B82F6] border-[#3B82F6]/50">
                    #{p.player_number} {p.display_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* PV Actions */}
          <div className={theme.card}>
            <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#B00020]" />
              <span className="font-semibold">Porteurs du Virus ({pvPlayers.length})</span>
            </div>
            <div className="divide-y divide-[#2D3748]">
              {pvPlayers.map(p => {
                const input = getInputForPlayer(p.player_number!);
                const bullets = getItemCount(p.player_number!, 'Balle PV');
                const antidotes = getItemCount(p.player_number!, 'Antidote PV');
                
                return (
                  <div key={p.id} className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                          #{p.player_number} {p.display_name}
                        </span>
                        {p.is_bot && <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <CapacityBadge 
                          available={bullets.available} 
                          total={1} 
                          icon={<Crosshair className="h-3 w-3" />} 
                          label="Balle" 
                          color="#B00020" 
                        />
                        <CapacityBadge 
                          available={antidotes.available} 
                          total={1} 
                          icon={<Syringe className="h-3 w-3" />} 
                          label="Antidote" 
                          color="#2AB3A6" 
                        />
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#9CA3AF]">
                      <div className="flex items-center gap-1">
                        <span>🎯 Tir:</span> 
                        <span className={input?.pv_shot_target_num ? 'text-white' : 'text-[#6B7280]'}>
                          {getPlayerName(input?.pv_shot_target_num ?? null)}
                        </span>
                        {input?.pv_shot_target_num && bullets.available <= 0 && (
                          <Badge className="bg-[#E6A23C]/20 text-[#E6A23C] text-xs px-1 py-0">Utilisé</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>💉 Antidote:</span> 
                        <span className={input?.pv_antidote_target_num ? 'text-[#2AB3A6]' : 'text-[#6B7280]'}>
                          {getPlayerName(input?.pv_antidote_target_num ?? null)}
                        </span>
                        {input?.pv_antidote_target_num && antidotes.available <= 0 && (
                          <Badge className="bg-[#E6A23C]/20 text-[#E6A23C] text-xs px-1 py-0">Utilisé</Badge>
                        )}
                      </div>
                      {manche === 1 && (
                        <div className="col-span-2 flex items-center gap-1">
                          <span>🦠 Patient 0:</span>
                          <span className={input?.pv_patient0_target_num ? 'text-[#B00020]' : 'text-[#6B7280]'}>
                            {getPlayerName(input?.pv_patient0_target_num ?? null)}
                          </span>
                        </div>
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
                {(() => {
                  const input = getInputForPlayer(baPlayer.player_number!);
                  const bullets = getItemCount(baPlayer.player_number!, 'Balle BA');
                  
                  return (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={baPlayer.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                            #{baPlayer.player_number} {baPlayer.display_name}
                          </span>
                          {baPlayer.is_bot && <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>}
                        </div>
                        <CapacityBadge 
                          available={bullets.available} 
                          total={1} 
                          icon={<Crosshair className="h-3 w-3" />} 
                          label="Balle" 
                          color="#6B21A8" 
                        />
                      </div>
                      <div className="mt-2 text-xs text-[#9CA3AF] flex items-center gap-1">
                        <span>🎯 Tir:</span> 
                        <span className={input?.ba_shot_target_num ? 'text-white' : 'text-[#6B7280]'}>
                          {getPlayerName(input?.ba_shot_target_num ?? null)}
                        </span>
                        {input?.ba_shot_target_num && bullets.available <= 0 && (
                          <Badge className="bg-[#E6A23C]/20 text-[#E6A23C] text-xs px-1 py-0">Utilisé</Badge>
                        )}
                      </div>
                    </>
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
                    <div className="flex items-center gap-2">
                      <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                        #{p.player_number} {p.display_name}
                      </span>
                      {p.is_bot && <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>}
                    </div>
                    <div className="mt-2 text-xs text-[#9CA3AF] flex items-center gap-1">
                      <span>🔬 Recherche:</span>
                      <span className={input?.sy_research_target_num ? 'text-[#2AB3A6]' : 'text-[#6B7280]'}>
                        {getPlayerName(input?.sy_research_target_num ?? null)}
                      </span>
                      {input?.sy_research_target_num && (
                        <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6] text-xs px-1 py-0">Soumis</Badge>
                      )}
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
                <div className="flex items-center gap-2">
                  <span className={ocPlayer.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                    #{ocPlayer.player_number} {ocPlayer.display_name}
                  </span>
                  {ocPlayer.is_bot && <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>}
                </div>
                {(() => {
                  const input = getInputForPlayer(ocPlayer.player_number!);
                  return (
                    <div className="mt-2 text-xs text-[#9CA3AF] flex items-center gap-1">
                      <span>🔮 Consultation:</span>
                      <span className={input?.oc_lookup_target_num ? 'text-[#E6A23C]' : 'text-[#6B7280]'}>
                        {getPlayerName(input?.oc_lookup_target_num ?? null)}
                      </span>
                      {input?.oc_lookup_target_num && (
                        <Badge className="bg-[#E6A23C]/20 text-[#E6A23C] text-xs px-1 py-0">Consulté</Badge>
                      )}
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
                const hasGilet = getItemCount(p.player_number!, 'Gilet').available > 0;
                const hasAntidote = getItemCount(p.player_number!, 'Antidote Ezkar').available > 0;
                
                return (
                  <div key={p.id} className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                          #{p.player_number} {p.display_name}
                        </span>
                        {p.is_bot && <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasGilet && (
                          <Badge className="bg-[#3B82F6]/20 text-[#3B82F6] text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Gilet
                          </Badge>
                        )}
                        {hasAntidote && (
                          <Badge className="bg-[#2AB3A6]/20 text-[#2AB3A6] text-xs">
                            <Syringe className="h-3 w-3 mr-1" />
                            Antidote
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#9CA3AF]">
                      <div className="flex items-center gap-1">
                        <span>🎯 Sabotage:</span>
                        <span className={input?.ae_sabotage_target_num ? 'text-white' : 'text-[#6B7280]'}>
                          {getPlayerName(input?.ae_sabotage_target_num ?? null)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>💰 Corruption:</span>
                        <span className={input?.corruption_amount ? 'text-[#D4AF37]' : 'text-[#6B7280]'}>
                          {input?.corruption_amount ?? 0} jetons
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {aePlayers.length === 0 && (
                <div className="p-4 text-center text-[#6B7280]">Aucun AE</div>
              )}
            </div>
          </div>

          {/* CV Actions - Citoyens Vaccinés */}
          {cvPlayers.length > 0 && (
            <div className={theme.card}>
              <div className="p-3 border-b border-[#2D3748] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#9CA3AF]" />
                  <span className="font-semibold">Citoyens Vaccinés ({cvPlayers.length})</span>
                </div>
                {antibodyCarrier && (
                  <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50">
                    🧬 Anticorps: #{antibodyCarrier.player_number} {antibodyCarrier.display_name}
                  </Badge>
                )}
              </div>
              <div className="divide-y divide-[#2D3748]">
                {cvPlayers.map(p => (
                  <div key={p.id} className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                          #{p.player_number} {p.display_name}
                        </span>
                        {p.is_bot && <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>}
                      </div>
                      {p.has_antibodies && (
                        <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs animate-pulse">
                          🧬 Porteur Anticorps
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KK Actions - Kamikazes */}
          {kkPlayers.length > 0 && (
            <div className={theme.card}>
              <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#6B7280]" />
                <span className="font-semibold">Kamikazes ({kkPlayers.length})</span>
              </div>
              <div className="divide-y divide-[#2D3748]">
                {kkPlayers.map(p => (
                  <div key={p.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className={p.is_alive === false ? 'line-through text-[#6B7280]' : ''}>
                        #{p.player_number} {p.display_name}
                      </span>
                      {p.is_bot && <Badge variant="outline" className="text-xs px-1 py-0">BOT</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                  const targetPlayer = getPlayerByNum(shot.target_num);
                  const hasGilet = targetPlayer ? getItemCount(shot.target_num, 'Gilet').available > 0 : false;
                  
                  return (
                    <div key={shot.id} className="p-3 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#6B7280] font-mono text-xs">#{idx + 1}</span>
                        <Badge style={{ backgroundColor: `${roleInfo?.color || '#666'}20`, color: roleInfo?.color || '#666' }}>
                          {roleInfo?.short || shot.shooter_role}
                        </Badge>
                        <span>{getPlayerName(shot.shooter_num)}</span>
                        <span className="text-[#6B7280]">→</span>
                        <span className="text-[#B00020]">{getPlayerName(shot.target_num)}</span>
                        {hasGilet && (
                          <Badge className="bg-[#3B82F6]/20 text-[#3B82F6] text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Gilet
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={shot.status === 'PENDING' ? 'outline' : shot.status === 'APPLIED' ? 'default' : 'secondary'}>
                          {shot.status}
                        </Badge>
                        {shot.ignore_reason && (
                          <Badge variant="secondary" className="text-xs">
                            {shot.ignore_reason}
                          </Badge>
                        )}
                      </div>
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
                              const botPlayer = getPlayerByNum(result.player_number);
                              const hasGilet = botPlayer ? getItemCount(result.player_number, 'Gilet').available > 0 : false;
                              
                              return (
                                <div key={idx} className="flex items-center gap-2 text-xs flex-wrap">
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
                                  
                                  {/* Protection indicators */}
                                  {hasGilet && (
                                    <Badge className="bg-[#3B82F6]/20 text-[#3B82F6] text-xs px-1 py-0">
                                      <Shield className="h-2 w-2 mr-0.5" />
                                      Gilet
                                    </Badge>
                                  )}
                                  {result.protected_by_gilet && (
                                    <Badge className="bg-[#3B82F6]/20 text-[#3B82F6] text-xs px-1 py-0">
                                      <Shield className="h-2 w-2 mr-0.5" />
                                      Protégé
                                    </Badge>
                                  )}
                                  
                                  {/* Corruption indicator */}
                                  {result.corruption_paid && result.corruption_paid > 0 && (
                                    <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs px-1 py-0">
                                      💰 {result.corruption_paid}j
                                    </Badge>
                                  )}
                                  
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
