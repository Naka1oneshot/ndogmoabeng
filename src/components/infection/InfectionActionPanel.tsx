import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Syringe, Search, Eye, Skull, Coins, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  team_code?: string | null;
  clan?: string | null;
  jetons: number | null;
  is_host?: boolean;
}

interface InfectionInput {
  ae_sabotage_target_num: number | null;
  corruption_amount: number;
  pv_patient0_target_num: number | null;
  pv_antidote_target_num: number | null;
  sy_research_target_num: number | null;
  oc_lookup_target_num: number | null;
  ezkar_antidote_target_num: number | null;
}

interface InfectionActionPanelProps {
  gameId: string;
  sessionGameId: string;
  manche: number;
  player: Player;
  allPlayers: Player[];
  isLocked: boolean;
}

// Special value for "do not use" option
const NO_ACTION_VALUE = '-1';

export function InfectionActionPanel({
  gameId,
  sessionGameId,
  manche,
  player,
  allPlayers,
  isLocked,
}: InfectionActionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState<InfectionInput>({
    ae_sabotage_target_num: null,
    corruption_amount: 0,
    pv_patient0_target_num: null,
    pv_antidote_target_num: null,
    sy_research_target_num: null,
    oc_lookup_target_num: null,
    ezkar_antidote_target_num: null,
  });
  const [currentShotTarget, setCurrentShotTarget] = useState<number | null>(null);
  const [hasUsedBulletPreviousRound, setHasUsedBulletPreviousRound] = useState(false);
  const [bulletCount, setBulletCount] = useState(0);
  const [alreadyResearchedTargets, setAlreadyResearchedTargets] = useState<number[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  
  // Check if player is from Ezkar clan (case-insensitive)
  const isEzkarClan = player.clan?.toLowerCase() === 'ezkar';
  const isPV = player.role_code === 'PV';

  // Filter out MJ (host) from all player lists
  const selectablePlayers = allPlayers.filter(p => !p.is_host);
  
  // Alive players excluding self and MJ
  const alivePlayers = selectablePlayers.filter(p => p.is_alive !== false && p.player_number !== player.player_number);
  
  // For antidote: include self in the list (PV can self-inject)
  const alivePlayersWithSelf = selectablePlayers.filter(p => p.is_alive !== false);
  
  // For corruption: exclude AE player
  const aePlayer = selectablePlayers.find(p => p.role_code === 'AE');
  const corruptionTargetPlayers = alivePlayers.filter(p => p.role_code !== 'AE');
  
  // For SY: filter out already researched targets
  const availableResearchTargets = player.role_code === 'SY' 
    ? alivePlayers.filter(p => !alreadyResearchedTargets.includes(p.player_number!))
    : alivePlayers;

  useEffect(() => {
    loadCurrentInputs();
    loadInventoryState();
    if (player.role_code === 'SY') {
      loadPreviousResearches();
    }
  }, [sessionGameId, manche, player.id, player.role_code]);

  const loadCurrentInputs = async () => {
    const { data } = await supabase
      .from('infection_inputs')
      .select('*')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .eq('player_id', player.id)
      .maybeSingle();

    if (data) {
      setInputs({
        ae_sabotage_target_num: data.ae_sabotage_target_num,
        corruption_amount: data.corruption_amount || 0,
        pv_patient0_target_num: data.pv_patient0_target_num,
        pv_antidote_target_num: data.pv_antidote_target_num,
        sy_research_target_num: data.sy_research_target_num,
        oc_lookup_target_num: data.oc_lookup_target_num,
        ezkar_antidote_target_num: (data as any).ezkar_antidote_target_num ?? null,
      });
    }
  };

  const loadInventoryState = async () => {
    // Check for shots this round
    const { data: shots } = await supabase
      .from('infection_shots')
      .select('id, target_num')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .eq('shooter_num', player.player_number);

    if (shots && shots.length > 0) {
      setCurrentShotTarget(shots[0].target_num);
    } else {
      setCurrentShotTarget(null);
    }

    // Check bullet count
    const bulletType = player.role_code === 'BA' ? 'Balle BA' : 'Balle PV';
    const { data: ammo } = await supabase
      .from('inventory')
      .select('quantite')
      .eq('session_game_id', sessionGameId)
      .eq('owner_num', player.player_number)
      .eq('objet', bulletType)
      .maybeSingle();

    setBulletCount(ammo?.quantite || 0);

    // For PV, check if they've shot in a PREVIOUS round (locked, can't change)
    if (player.role_code === 'PV') {
      const { data: previousShots } = await supabase
        .from('infection_shots')
        .select('id')
        .eq('session_game_id', sessionGameId)
        .eq('shooter_num', player.player_number)
        .lt('manche', manche);
      setHasUsedBulletPreviousRound(previousShots && previousShots.length > 0);
    }
  };

  const loadPreviousResearches = async () => {
    // Load all previous research targets for this SY player (from previous manches only)
    const { data: previousInputs } = await supabase
      .from('infection_inputs')
      .select('sy_research_target_num')
      .eq('session_game_id', sessionGameId)
      .eq('player_id', player.id)
      .not('sy_research_target_num', 'is', null)
      .lt('manche', manche);

    if (previousInputs) {
      const targets = previousInputs
        .map(input => input.sy_research_target_num)
        .filter((num): num is number => num !== null);
      setAlreadyResearchedTargets(targets);
    }
  };

  const submitAction = async (actionType: string, targetNum?: number | null, amount?: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('infection-submit-action', {
        body: {
          gameId,
          sessionGameId,
          manche,
          playerId: player.id,
          playerNum: player.player_number,
          actionType,
          targetNum: targetNum === null ? null : targetNum, // Explicitly pass null to clear
          amount,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to submit');

      toast.success('Action enregistrée');
      loadCurrentInputs();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const submitShot = async (targetNum: number | null) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('infection-submit-shot', {
        body: {
          gameId,
          sessionGameId,
          manche,
          shooterNum: player.player_number,
          shooterRole: player.role_code,
          targetNum, // null means cancel the shot
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to submit');

      toast.success(targetNum === null ? 'Tir annulé' : 'Tir enregistré!');
      setCurrentShotTarget(targetNum);
      loadInventoryState();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  // Handle select change with "no action" support
  const handleSelectChange = (value: string, field: keyof InfectionInput, actionType: string) => {
    if (value === NO_ACTION_VALUE) {
      setInputs(prev => ({ ...prev, [field]: null }));
      submitAction(actionType, null);
    } else {
      const numValue = parseInt(value);
      setInputs(prev => ({ ...prev, [field]: numValue }));
      submitAction(actionType, numValue);
    }
  };

  // Get display value for select (handle null as "no action")
  const getSelectValue = (value: number | null): string => {
    return value === null ? '' : String(value);
  };

  if (isLocked) {
    return (
      <div className="p-4 bg-[#1A2235] rounded-lg text-center text-[#6B7280]">
        <p>🔒 Les actions sont verrouillées pour cette manche.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* BA: Shoot */}
      {player.role_code === 'BA' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#B00020]/30">
          <h3 className="font-semibold text-[#B00020] mb-2 flex items-center gap-2">
            <Skull className="h-4 w-4" />
            Bras Armé — Tirer
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Balles disponibles: {bulletCount + (currentShotTarget !== null ? 1 : 0)}/2
          </p>
          {(bulletCount > 0 || currentShotTarget !== null) ? (
            <>
              <Select 
                value={currentShotTarget !== null ? String(currentShotTarget) : ''} 
                onValueChange={(v) => {
                  if (v === NO_ACTION_VALUE) {
                    submitShot(null);
                  } else {
                    submitShot(parseInt(v));
                  }
                }} 
                disabled={loading}
              >
                <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                  <SelectValue placeholder="Choisir une cible..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1A2235] border-[#2D3748]">
                  <SelectItem value={NO_ACTION_VALUE} className="text-[#6B7280]">
                    — Ne pas tirer —
                  </SelectItem>
                  {alivePlayers.map((p) => (
                    <SelectItem key={p.player_number} value={String(p.player_number)}>
                      #{p.player_number} - {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentShotTarget !== null && (
                <p className="text-xs text-[#B00020] mt-2">
                  ✓ Cible: #{currentShotTarget}
                </p>
              )}
            </>
          ) : (
            <p className="text-[#6B7280]">Aucune balle disponible</p>
          )}
        </div>
      )}

      {/* PV: Patient 0 (manche 1) + Shoot + Antidote */}
      {player.role_code === 'PV' && (
        <>
          {manche === 1 && (
            <div className="p-4 bg-[#1A2235] rounded-lg border border-[#B00020]/30">
              <h3 className="font-semibold text-[#B00020] mb-2 flex items-center gap-2">
                <Syringe className="h-4 w-4" />
                Patient 0 (obligatoire)
              </h3>
              <p className="text-sm text-[#6B7280] mb-3">
                Choisissez votre première victime du virus.
              </p>
              <Select 
                value={getSelectValue(inputs.pv_patient0_target_num)} 
                onValueChange={(v) => handleSelectChange(v, 'pv_patient0_target_num', 'PV_PATIENT0')}
                disabled={loading}
              >
                <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                  <SelectValue placeholder="Choisir Patient 0..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1A2235] border-[#2D3748]">
                  {alivePlayers.map((p) => (
                    <SelectItem key={p.player_number} value={String(p.player_number)}>
                      #{p.player_number} - {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="p-4 bg-[#1A2235] rounded-lg border border-[#B00020]/30">
            <h3 className="font-semibold text-[#B00020] mb-2 flex items-center gap-2">
              <Skull className="h-4 w-4" />
              Tirer (1 balle pour la partie)
            </h3>
            {hasUsedBulletPreviousRound ? (
              <p className="text-[#6B7280]">Balle déjà utilisée dans une manche précédente</p>
            ) : (bulletCount > 0 || currentShotTarget !== null) ? (
              <>
                <Select 
                  value={currentShotTarget !== null ? String(currentShotTarget) : ''} 
                  onValueChange={(v) => {
                    if (v === NO_ACTION_VALUE) {
                      submitShot(null);
                    } else {
                      submitShot(parseInt(v));
                    }
                  }} 
                  disabled={loading}
                >
                  <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                    <SelectValue placeholder="Choisir une cible..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A2235] border-[#2D3748]">
                    <SelectItem value={NO_ACTION_VALUE} className="text-[#6B7280]">
                      — Ne pas tirer —
                    </SelectItem>
                    {alivePlayers.map((p) => (
                      <SelectItem key={p.player_number} value={String(p.player_number)}>
                        #{p.player_number} - {p.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {currentShotTarget !== null && (
                  <p className="text-xs text-[#B00020] mt-2">
                    ✓ Cible: #{currentShotTarget}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[#6B7280]">Aucune balle disponible</p>
            )}
          </div>

          <div className="p-4 bg-[#1A2235] rounded-lg border border-[#2AB3A6]/30">
            <h3 className="font-semibold text-[#2AB3A6] mb-2 flex items-center gap-2">
              <Syringe className="h-4 w-4" />
              Antidote (optionnel) {isEzkarClan && <span className="text-xs bg-[#2AB3A6]/20 px-2 py-0.5 rounded">2 doses</span>}
            </h3>
            <p className="text-sm text-[#6B7280] mb-3">
              Tu peux t'injecter l'antidote à toi-même.
            </p>
            <Select 
              value={getSelectValue(inputs.pv_antidote_target_num)} 
              onValueChange={(v) => handleSelectChange(v, 'pv_antidote_target_num', 'PV_ANTIDOTE')}
              disabled={loading}
            >
              <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                <SelectValue placeholder="Administrer à..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1A2235] border-[#2D3748]">
                <SelectItem value={NO_ACTION_VALUE} className="text-[#6B7280]">
                  — Ne pas utiliser —
                </SelectItem>
                {alivePlayersWithSelf.map((p) => (
                  <SelectItem key={p.player_number} value={String(p.player_number)}>
                    #{p.player_number} - {p.display_name} {p.player_number === player.player_number ? '(moi)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {inputs.pv_antidote_target_num && (
              <p className="text-xs text-[#2AB3A6] mt-2">
                ✓ Cible: #{inputs.pv_antidote_target_num}
              </p>
            )}
          </div>
        </>
      )}

      {/* SY: Research */}
      {player.role_code === 'SY' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#2AB3A6]/30">
          <h3 className="font-semibold text-[#2AB3A6] mb-2 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Recherche anticorps (optionnel)
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Tous les SY doivent choisir la même cible pour réussir.
            {alreadyResearchedTargets.length > 0 && (
              <span className="block mt-1 text-[#D4AF37]">
                ⚠️ {alreadyResearchedTargets.length} joueur(s) déjà testé(s) (non disponibles)
              </span>
            )}
          </p>
          {availableResearchTargets.length === 0 ? (
            <p className="text-[#D4AF37]">Tous les joueurs vivants ont déjà été testés.</p>
          ) : (
            <Select 
              value={getSelectValue(inputs.sy_research_target_num)} 
              onValueChange={(v) => handleSelectChange(v, 'sy_research_target_num', 'SY_RESEARCH')}
              disabled={loading}
            >
              <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                <SelectValue placeholder="Tester qui..." />
              </SelectTrigger>
              <SelectContent className="bg-[#1A2235] border-[#2D3748]">
                <SelectItem value={NO_ACTION_VALUE} className="text-[#6B7280]">
                  — Ne pas tester —
                </SelectItem>
                {availableResearchTargets.map((p) => (
                  <SelectItem key={p.player_number} value={String(p.player_number)}>
                    #{p.player_number} - {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {inputs.sy_research_target_num && (
            <p className="text-xs text-[#2AB3A6] mt-2">
              ✓ Cible: #{inputs.sy_research_target_num}
            </p>
          )}
        </div>
      )}

      {/* OC: Lookup */}
      {player.role_code === 'OC' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#D4AF37]/30">
          <h3 className="font-semibold text-[#D4AF37] mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Consultation Oracle (optionnel)
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Révélez le rôle d'un joueur (1 fois par manche).
          </p>
          <Select 
            value={getSelectValue(inputs.oc_lookup_target_num)} 
            onValueChange={(v) => handleSelectChange(v, 'oc_lookup_target_num', 'OC_LOOKUP')}
            disabled={loading}
          >
            <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
              <SelectValue placeholder="Consulter qui..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1A2235] border-[#2D3748]">
              <SelectItem value={NO_ACTION_VALUE} className="text-[#6B7280]">
                — Ne pas consulter —
              </SelectItem>
              {alivePlayers.map((p) => (
                <SelectItem key={p.player_number} value={String(p.player_number)}>
                  #{p.player_number} - {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inputs.oc_lookup_target_num && (
            <p className="text-xs text-[#D4AF37] mt-2">
              ✓ Cible: #{inputs.oc_lookup_target_num}
            </p>
          )}
        </div>
      )}

      {/* AE: Sabotage */}
      {player.role_code === 'AE' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#D4AF37]/30">
          <h3 className="font-semibold text-[#D4AF37] mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Identifier le Bras Armé (optionnel)
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Si correct, la corruption sera activée.
          </p>
          <Select 
            value={getSelectValue(inputs.ae_sabotage_target_num)} 
            onValueChange={(v) => handleSelectChange(v, 'ae_sabotage_target_num', 'AE_SABOTAGE')}
            disabled={loading}
          >
            <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
              <SelectValue placeholder="Le BA est..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1A2235] border-[#2D3748]">
              <SelectItem value={NO_ACTION_VALUE} className="text-[#6B7280]">
                — Ne pas identifier —
              </SelectItem>
              {alivePlayers.map((p) => (
                <SelectItem key={p.player_number} value={String(p.player_number)}>
                  #{p.player_number} - {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inputs.ae_sabotage_target_num && (
            <p className="text-xs text-[#D4AF37] mt-2">
              ✓ Cible: #{inputs.ae_sabotage_target_num}
            </p>
          )}
        </div>
      )}

      {/* Corruption - displayed to all players except AE */}
      {player.role_code !== 'AE' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#D4AF37]/30">
          <h3 className="font-semibold text-[#D4AF37] mb-2 flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Corruption de l'AE
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Misez des jetons pour l'Agent Ezkar. Citoyens: seuil 10 pour bloquer BA. PV: seuil 15 pour débloquer.
          </p>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              max={player.jetons || 0}
              value={inputs.corruption_amount}
              onChange={(e) => {
                setInputs(prev => ({ ...prev, corruption_amount: parseInt(e.target.value) || 0 }));
              }}
              onBlur={() => submitAction('CORRUPTION', undefined, inputs.corruption_amount)}
              className="flex-1 bg-[#0B0E14] border-[#2D3748]"
              disabled={loading}
            />
          </div>
          <p className="text-xs text-[#6B7280] mt-2">
            Max: {player.jetons || 0} jetons
          </p>
        </div>
      )}

      {/* Ezkar Clan Antidote - displayed to all Ezkar clan players (except PV who have their own) */}
      {isEzkarClan && !isPV && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#2AB3A6]/30">
          <h3 className="font-semibold text-[#2AB3A6] mb-2 flex items-center gap-2">
            <Syringe className="h-4 w-4" />
            Antidote (optionnel)
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            En tant que membre du clan Ezkar, tu possèdes un antidote.
          </p>
          <Select 
            value={getSelectValue(inputs.ezkar_antidote_target_num)} 
            onValueChange={(v) => handleSelectChange(v, 'ezkar_antidote_target_num', 'EZKAR_ANTIDOTE')}
            disabled={loading}
          >
            <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
              <SelectValue placeholder="Administrer à..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1A2235] border-[#2D3748]">
              <SelectItem value={NO_ACTION_VALUE} className="text-[#6B7280]">
                — Ne pas utiliser —
              </SelectItem>
              {alivePlayersWithSelf.map((p) => (
                <SelectItem key={p.player_number} value={String(p.player_number)}>
                  #{p.player_number} - {p.display_name} {p.player_number === player.player_number ? '(moi)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inputs.ezkar_antidote_target_num && (
            <p className="text-xs text-[#2AB3A6] mt-2">
              ✓ Cible: #{inputs.ezkar_antidote_target_num}
            </p>
          )}
        </div>
      )}

      {/* Global Validation Button */}
      <div className="p-4 bg-[#1A2235] rounded-lg border border-[#2AB3A6]/50">
        <GlobalValidationButton 
          gameId={gameId}
          sessionGameId={sessionGameId}
          player={player}
          manche={manche}
          inputs={inputs}
          isLocked={isLocked}
          loading={loading}
        />
      </div>
    </div>
  );
}

// Component for global validation button
interface GlobalValidationButtonProps {
  gameId: string;
  sessionGameId: string;
  player: Player;
  manche: number;
  inputs: InfectionInput;
  isLocked: boolean;
  loading: boolean;
}

function GlobalValidationButton({ gameId, sessionGameId, player, manche, inputs, isLocked, loading }: GlobalValidationButtonProps) {
  const [validated, setValidated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if all mandatory choices are made
  const areMandatoryChoicesMade = (): boolean => {
    // PV must choose Patient 0 in manche 1
    if (player.role_code === 'PV' && manche === 1) {
      if (inputs.pv_patient0_target_num === null) {
        return false;
      }
    }
    // All other choices are optional
    return true;
  };

  const handleValidate = async () => {
    setIsSubmitting(true);
    try {
      // Ensure a record exists in infection_inputs by submitting CORRUPTION with current value
      // This creates/updates the record which the presentation view uses to track validation
      const { error } = await supabase.functions.invoke('infection-submit-action', {
        body: {
          gameId,
          sessionGameId,
          manche,
          playerId: player.id,
          playerNum: player.player_number,
          actionType: 'CORRUPTION',
          amount: inputs.corruption_amount || 0,
        },
      });

      if (error) {
        console.error('[GlobalValidationButton] Error:', error);
        toast.error('Erreur lors de la validation');
        return;
      }

      setValidated(true);
      toast.success('Choix validés !');
    } catch (err) {
      console.error('[GlobalValidationButton] Exception:', err);
      toast.error('Erreur lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canValidate = areMandatoryChoicesMade() && !isLocked && !loading && !isSubmitting;

  if (isLocked) {
    return (
      <div className="flex items-center gap-2 text-[#6B7280]">
        <Clock className="h-4 w-4" />
        <span>Manche verrouillée — résolution en cours</span>
      </div>
    );
  }

  if (validated) {
    return (
      <div className="flex items-center gap-2 text-[#2AB3A6]">
        <Check className="h-5 w-5" />
        <span className="font-medium">Choix validés — en attente de résolution</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleValidate}
        disabled={!canValidate}
        className="w-full bg-[#2AB3A6] hover:bg-[#2AB3A6]/80 text-white disabled:opacity-50"
      >
        {isSubmitting ? (
          <>Validation...</>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Valider mes choix
          </>
        )}
      </Button>
      {!areMandatoryChoicesMade() && (
        <p className="text-xs text-[#D4AF37] text-center">
          ⚠️ Vous devez compléter vos choix obligatoires avant de valider
        </p>
      )}
    </div>
  );
}
