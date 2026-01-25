import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Syringe, Search, Eye, Skull, Coins } from 'lucide-react';
import { toast } from 'sonner';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_alive: boolean | null;
  role_code: string | null;
  jetons: number | null;
}

interface InfectionInput {
  ae_sabotage_target_num: number | null;
  corruption_amount: number;
  pv_patient0_target_num: number | null;
  pv_antidote_target_num: number | null;
  sy_research_target_num: number | null;
  oc_lookup_target_num: number | null;
}

interface InfectionActionPanelProps {
  gameId: string;
  sessionGameId: string;
  manche: number;
  player: Player;
  allPlayers: Player[];
  isLocked: boolean;
}

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
  });
  const [hasShotThisRound, setHasShotThisRound] = useState(false);
  const [hasUsedBullet, setHasUsedBullet] = useState(false);
  const [bulletCount, setBulletCount] = useState(0);
  const [alreadyResearchedTargets, setAlreadyResearchedTargets] = useState<number[]>([]);

  const alivePlayers = allPlayers.filter(p => p.is_alive !== false && p.player_number !== player.player_number);
  
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
      });
    }
  };

  const loadInventoryState = async () => {
    // Check for shots this round
    const { data: shots } = await supabase
      .from('infection_shots')
      .select('id')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .eq('shooter_num', player.player_number);

    setHasShotThisRound(shots && shots.length > 0);

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

    // For PV, check if they've ever shot
    if (player.role_code === 'PV') {
      const { data: allShots } = await supabase
        .from('infection_shots')
        .select('id')
        .eq('session_game_id', sessionGameId)
        .eq('shooter_num', player.player_number);
      setHasUsedBullet(allShots && allShots.length > 0);
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

  const submitAction = async (actionType: string, targetNum?: number, amount?: number) => {
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
          targetNum,
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

  const submitShot = async (targetNum: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('infection-submit-shot', {
        body: {
          gameId,
          sessionGameId,
          manche,
          shooterNum: player.player_number,
          shooterRole: player.role_code,
          targetNum,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to submit');

      toast.success('Tir enregistré!');
      loadInventoryState();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
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
            Balles disponibles: {bulletCount}/2
          </p>
          {hasShotThisRound ? (
            <p className="text-[#2AB3A6]">✓ Tir enregistré pour cette manche</p>
          ) : bulletCount > 0 ? (
            <div className="flex gap-2">
              <Select onValueChange={(v) => submitShot(parseInt(v))} disabled={loading}>
                <SelectTrigger className="flex-1 bg-[#0B0E14] border-[#2D3748]">
                  <SelectValue placeholder="Choisir une cible..." />
                </SelectTrigger>
                <SelectContent>
                  {alivePlayers.map((p) => (
                    <SelectItem key={p.player_number} value={String(p.player_number)}>
                      #{p.player_number} - {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                value={inputs.pv_patient0_target_num?.toString() || ''} 
                onValueChange={(v) => {
                  setInputs(prev => ({ ...prev, pv_patient0_target_num: parseInt(v) }));
                  submitAction('PV_PATIENT0', parseInt(v));
                }}
                disabled={loading}
              >
                <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                  <SelectValue placeholder="Choisir Patient 0..." />
                </SelectTrigger>
                <SelectContent>
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
            {hasUsedBullet || hasShotThisRound ? (
              <p className="text-[#6B7280]">Balle déjà utilisée</p>
            ) : bulletCount > 0 ? (
              <Select onValueChange={(v) => submitShot(parseInt(v))} disabled={loading}>
                <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                  <SelectValue placeholder="Choisir une cible..." />
                </SelectTrigger>
                <SelectContent>
                  {alivePlayers.map((p) => (
                    <SelectItem key={p.player_number} value={String(p.player_number)}>
                      #{p.player_number} - {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-[#6B7280]">Aucune balle disponible</p>
            )}
          </div>

          <div className="p-4 bg-[#1A2235] rounded-lg border border-[#2AB3A6]/30">
            <h3 className="font-semibold text-[#2AB3A6] mb-2 flex items-center gap-2">
              <Syringe className="h-4 w-4" />
              Antidote
            </h3>
            <Select 
              value={inputs.pv_antidote_target_num?.toString() || ''} 
              onValueChange={(v) => {
                setInputs(prev => ({ ...prev, pv_antidote_target_num: parseInt(v) }));
                submitAction('PV_ANTIDOTE', parseInt(v));
              }}
              disabled={loading}
            >
              <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                <SelectValue placeholder="Administrer à..." />
              </SelectTrigger>
              <SelectContent>
                {alivePlayers.map((p) => (
                  <SelectItem key={p.player_number} value={String(p.player_number)}>
                    #{p.player_number} - {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* SY: Research */}
      {player.role_code === 'SY' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#2AB3A6]/30">
          <h3 className="font-semibold text-[#2AB3A6] mb-2 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Recherche anticorps
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
              value={inputs.sy_research_target_num?.toString() || ''} 
              onValueChange={(v) => {
                setInputs(prev => ({ ...prev, sy_research_target_num: parseInt(v) }));
                submitAction('SY_RESEARCH', parseInt(v));
              }}
              disabled={loading}
            >
              <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
                <SelectValue placeholder="Tester qui..." />
              </SelectTrigger>
              <SelectContent>
                {availableResearchTargets.map((p) => (
                  <SelectItem key={p.player_number} value={String(p.player_number)}>
                    #{p.player_number} - {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* OC: Lookup */}
      {player.role_code === 'OC' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#D4AF37]/30">
          <h3 className="font-semibold text-[#D4AF37] mb-2 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Consultation Oracle
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Révélez le rôle d'un joueur (1 fois par manche).
          </p>
          <Select 
            value={inputs.oc_lookup_target_num?.toString() || ''} 
            onValueChange={(v) => {
              setInputs(prev => ({ ...prev, oc_lookup_target_num: parseInt(v) }));
              submitAction('OC_LOOKUP', parseInt(v));
            }}
            disabled={loading}
          >
            <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
              <SelectValue placeholder="Consulter qui..." />
            </SelectTrigger>
            <SelectContent>
              {alivePlayers.map((p) => (
                <SelectItem key={p.player_number} value={String(p.player_number)}>
                  #{p.player_number} - {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* AE: Sabotage */}
      {player.role_code === 'AE' && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#D4AF37]/30">
          <h3 className="font-semibold text-[#D4AF37] mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Identifier le Bras Armé
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Si correct, la corruption sera activée.
          </p>
          <Select 
            value={inputs.ae_sabotage_target_num?.toString() || ''} 
            onValueChange={(v) => {
              setInputs(prev => ({ ...prev, ae_sabotage_target_num: parseInt(v) }));
              submitAction('AE_SABOTAGE', parseInt(v));
            }}
            disabled={loading}
          >
            <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
              <SelectValue placeholder="Le BA est..." />
            </SelectTrigger>
            <SelectContent>
              {alivePlayers.map((p) => (
                <SelectItem key={p.player_number} value={String(p.player_number)}>
                  #{p.player_number} - {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Corruption (everyone) */}
      <div className="p-4 bg-[#1A2235] rounded-lg border border-[#D4AF37]/30">
        <h3 className="font-semibold text-[#D4AF37] mb-2 flex items-center gap-2">
          <Coins className="h-4 w-4" />
          Corruption
        </h3>
        <p className="text-sm text-[#6B7280] mb-3">
          Misez des jetons. Citoyens: seuil 10 pour bloquer BA. PV: seuil 15 pour débloquer.
        </p>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            max={player.jetons || 0}
            value={inputs.corruption_amount}
            onChange={(e) => setInputs(prev => ({ ...prev, corruption_amount: parseInt(e.target.value) || 0 }))}
            className="flex-1 bg-[#0B0E14] border-[#2D3748]"
            disabled={loading}
          />
          <Button 
            onClick={() => submitAction('CORRUPTION', undefined, inputs.corruption_amount)}
            disabled={loading}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black"
          >
            Miser
          </Button>
        </div>
        <p className="text-xs text-[#6B7280] mt-2">
          Max: {player.jetons || 0} jetons
        </p>
      </div>
    </div>
  );
}
