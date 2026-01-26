import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FlaskConical, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_alive: boolean | null;
  role_code?: string | null;
  team_code?: string | null;
  is_host?: boolean;
}

interface InfectionVotePanelProps {
  gameId: string;
  sessionGameId: string;
  manche: number;
  player: Player;
  allPlayers: Player[];
  isLocked: boolean;
}

// Special value for "do not vote" option
const NO_VOTE_VALUE = '-1';

export function InfectionVotePanel({
  gameId,
  sessionGameId,
  manche,
  player,
  allPlayers,
  isLocked,
}: InfectionVotePanelProps) {
  const [loading, setLoading] = useState(false);
  const [voteTest, setVoteTest] = useState<number | null>(null);
  const [voteSuspect, setVoteSuspect] = useState<number | null>(null);

  // Filter out MJ (host) from selectable players
  const selectablePlayers = allPlayers.filter(p => !p.is_host);
  const alivePlayers = selectablePlayers.filter(p => p.is_alive !== false);
  
  // Check if current player is PV (PV team should not see suspicion vote)
  const isPVTeam = player.team_code === 'PV' || player.role_code === 'PV' || player.role_code === 'PS';

  useEffect(() => {
    loadCurrentVotes();
  }, [sessionGameId, manche, player.id]);

  const loadCurrentVotes = async () => {
    const { data } = await supabase
      .from('infection_inputs')
      .select('vote_test_target_num, vote_suspect_pv_target_num')
      .eq('session_game_id', sessionGameId)
      .eq('manche', manche)
      .eq('player_id', player.id)
      .maybeSingle();

    if (data) {
      setVoteTest(data.vote_test_target_num);
      setVoteSuspect(data.vote_suspect_pv_target_num);
    }
  };

  const submitVote = async (voteType: 'VOTE_TEST' | 'VOTE_SUSPECT', targetNum: number | null) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('infection-submit-action', {
        body: {
          gameId,
          sessionGameId,
          manche,
          playerId: player.id,
          playerNum: player.player_number,
          actionType: voteType,
          targetNum, // null means clear the vote
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to submit');

      toast.success(targetNum === null ? 'Vote annulé' : 'Vote enregistré');
      
      if (voteType === 'VOTE_TEST') {
        setVoteTest(targetNum);
      } else {
        setVoteSuspect(targetNum);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteChange = (value: string, voteType: 'VOTE_TEST' | 'VOTE_SUSPECT') => {
    if (value === NO_VOTE_VALUE) {
      submitVote(voteType, null);
    } else {
      submitVote(voteType, parseInt(value));
    }
  };

  const getSelectValue = (value: number | null): string => {
    return value === null ? '' : String(value);
  };

  if (isLocked) {
    return (
      <div className="p-4 bg-[#1A2235] rounded-lg text-center text-[#6B7280]">
        <p>🔒 Les votes sont verrouillés pour cette manche.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vote: Test anticorps */}
      <div className="p-4 bg-[#1A2235] rounded-lg border border-[#2AB3A6]/30">
        <h3 className="font-semibold text-[#2AB3A6] mb-2 flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Test anticorps (optionnel)
        </h3>
        <p className="text-sm text-[#6B7280] mb-3">
          Votez pour qui devrait être testé. Le résultat sera privé.
        </p>
        <Select 
          value={getSelectValue(voteTest)} 
          onValueChange={(v) => handleVoteChange(v, 'VOTE_TEST')}
          disabled={loading}
        >
          <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
            <SelectValue placeholder="Voter pour tester..." />
          </SelectTrigger>
          <SelectContent className="bg-[#1A2235] border-[#2D3748]">
            <SelectItem value={NO_VOTE_VALUE} className="text-[#6B7280]">
              — Ne pas voter —
            </SelectItem>
            {alivePlayers.map((p) => (
              <SelectItem key={p.player_number} value={String(p.player_number)}>
                #{p.player_number} - {p.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {voteTest && (
          <p className="text-xs text-[#2AB3A6] mt-2">
            ✓ Vote: #{voteTest}
          </p>
        )}
      </div>

      {/* Vote: Soupçon PV - Only shown to non-PV players */}
      {!isPVTeam && (
        <div className="p-4 bg-[#1A2235] rounded-lg border border-[#B00020]/30">
          <h3 className="font-semibold text-[#B00020] mb-2 flex items-center gap-2">
            <Search className="h-4 w-4" />
            Soupçon PV (optionnel)
          </h3>
          <p className="text-sm text-[#6B7280] mb-3">
            Qui pensez-vous être un Porteur de Virus ?
          </p>
          <Select 
            value={getSelectValue(voteSuspect)} 
            onValueChange={(v) => handleVoteChange(v, 'VOTE_SUSPECT')}
            disabled={loading}
          >
            <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
              <SelectValue placeholder="Je soupçonne..." />
            </SelectTrigger>
            <SelectContent className="bg-[#1A2235] border-[#2D3748]">
              <SelectItem value={NO_VOTE_VALUE} className="text-[#6B7280]">
                — Ne pas voter —
              </SelectItem>
              {alivePlayers.map((p) => (
                <SelectItem key={p.player_number} value={String(p.player_number)}>
                  #{p.player_number} - {p.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {voteSuspect && (
            <p className="text-xs text-[#B00020] mt-2">
              ✓ Soupçon: #{voteSuspect}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
