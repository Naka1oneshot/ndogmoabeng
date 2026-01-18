import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';

interface RoundState {
  id: string;
  manche: number;
  status: string;
  resolved_at: string | null;
}

interface MJRoundHistorySelectorProps {
  sessionGameId: string;
  currentManche: number;
  selectedManche: number;
  onSelectManche: (manche: number) => void;
}

export function MJRoundHistorySelector({ 
  sessionGameId, 
  currentManche, 
  selectedManche, 
  onSelectManche 
}: MJRoundHistorySelectorProps) {
  const [rounds, setRounds] = useState<RoundState[]>([]);

  useEffect(() => {
    fetchRounds();

    const channel = supabase
      .channel(`mj-rounds-${sessionGameId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'infection_round_state', 
        filter: `session_game_id=eq.${sessionGameId}` 
      }, fetchRounds)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionGameId]);

  const fetchRounds = async () => {
    const { data } = await supabase
      .from('infection_round_state')
      .select('id, manche, status, resolved_at')
      .eq('session_game_id', sessionGameId)
      .order('manche', { ascending: true });

    if (data) {
      setRounds(data as RoundState[]);
    }
  };

  const getStatusBadge = (status: string, manche: number) => {
    if (manche === currentManche) {
      return (
        <Badge className="ml-2 bg-[#2AB3A6]/20 text-[#2AB3A6] text-xs">
          Active
        </Badge>
      );
    }
    if (status === 'RESOLVED') {
      return (
        <Badge className="ml-2 bg-[#6B7280]/20 text-[#6B7280] text-xs">
          Terminée
        </Badge>
      );
    }
    return null;
  };

  if (rounds.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <History className="h-4 w-4 text-[#D4AF37]" />
      <Select 
        value={selectedManche.toString()} 
        onValueChange={(v) => onSelectManche(parseInt(v))}
      >
        <SelectTrigger className="w-[180px] bg-[#1A2235] border-[#2D3748]">
          <SelectValue placeholder="Sélectionner manche" />
        </SelectTrigger>
        <SelectContent className="bg-[#1A2235] border-[#2D3748]">
          {rounds.map(round => (
            <SelectItem key={round.id} value={round.manche.toString()}>
              <div className="flex items-center">
                <span>Manche {round.manche}</span>
                {getStatusBadge(round.status, round.manche)}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedManche !== currentManche && (
        <Badge 
          className="bg-[#E6A23C]/20 text-[#E6A23C] cursor-pointer"
          onClick={() => onSelectManche(currentManche)}
        >
          ← Retour manche active
        </Badge>
      )}
    </div>
  );
}
