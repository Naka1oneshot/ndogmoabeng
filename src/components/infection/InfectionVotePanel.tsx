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
}

interface InfectionVotePanelProps {
  gameId: string;
  sessionGameId: string;
  manche: number;
  player: Player;
  allPlayers: Player[];
  isLocked: boolean;
}

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

  const alivePlayers = allPlayers.filter(p => p.is_alive !== false);

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

  const submitVote = async (voteType: 'VOTE_TEST' | 'VOTE_SUSPECT', targetNum: number) => {
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
          targetNum,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to submit');

      toast.success('Vote enregistré');
      
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
          Test anticorps
        </h3>
        <p className="text-sm text-[#6B7280] mb-3">
          Votez pour qui devrait être testé. Le résultat sera privé.
        </p>
        <Select 
          value={voteTest?.toString() || ''} 
          onValueChange={(v) => submitVote('VOTE_TEST', parseInt(v))}
          disabled={loading}
        >
          <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
            <SelectValue placeholder="Voter pour tester..." />
          </SelectTrigger>
          <SelectContent>
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

      {/* Vote: Soupçon PV */}
      <div className="p-4 bg-[#1A2235] rounded-lg border border-[#B00020]/30">
        <h3 className="font-semibold text-[#B00020] mb-2 flex items-center gap-2">
          <Search className="h-4 w-4" />
          Soupçon PV
        </h3>
        <p className="text-sm text-[#6B7280] mb-3">
          Qui pensez-vous être un Porteur de Virus ?
        </p>
        <Select 
          value={voteSuspect?.toString() || ''} 
          onValueChange={(v) => submitVote('VOTE_SUSPECT', parseInt(v))}
          disabled={loading}
        >
          <SelectTrigger className="bg-[#0B0E14] border-[#2D3748]">
            <SelectValue placeholder="Je soupçonne..." />
          </SelectTrigger>
          <SelectContent>
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
    </div>
  );
}
