import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wallet, ArrowDownRight } from 'lucide-react';

interface PlayerChoice {
  id: string;
  player_number: number;
  visa_choice: string | null;
  visa_cost_applied: number;
  tokens_entering: number | null;
  has_illegal_tokens: boolean;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_bot?: boolean;
}

interface SheriffPoolHistoryPanelProps {
  choices: PlayerChoice[];
  players: Player[];
  poolInitial: number;
  poolSpent: number;
  poolFloorPercent?: number;
  costPerPlayer?: number;
}

export function SheriffPoolHistoryPanel({
  choices,
  players,
  poolInitial,
  poolSpent,
  poolFloorPercent = 40,
  costPerPlayer = 10,
}: SheriffPoolHistoryPanelProps) {
  // Filter only pool users
  const poolUsers = choices.filter(c => c.visa_choice === 'COMMON_POOL');
  
  const getPlayerName = (playerNum: number): string => {
    const player = players.find(p => p.player_number === playerNum);
    return player?.display_name || `Joueur ${playerNum}`;
  };

  const isBot = (playerNum: number): boolean => {
    const player = players.find(p => p.player_number === playerNum);
    return player?.is_bot || false;
  };

  const poolFloor = poolInitial * (poolFloorPercent / 100);
  const poolCurrent = poolInitial - poolSpent;
  const isAtFloor = poolCurrent <= poolFloor;

  if (poolUsers.length === 0) {
    return (
      <div className="text-center text-[#9CA3AF] py-4 text-sm">
        Aucun joueur n'a utilisé la cagnotte pour cette session
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pool Summary */}
      <div className="grid grid-cols-3 gap-2 text-center p-3 bg-[#1A1F2C] rounded-lg border border-[#D4AF37]/20">
        <div>
          <p className="text-lg font-bold text-[#D4AF37]">{poolInitial.toFixed(0)}€</p>
          <p className="text-xs text-[#9CA3AF]">Initial</p>
        </div>
        <div>
          <p className="text-lg font-bold text-red-400">-{poolSpent.toFixed(0)}€</p>
          <p className="text-xs text-[#9CA3AF]">Dépensé</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${isAtFloor ? 'text-amber-500' : 'text-green-500'}`}>
            {poolCurrent.toFixed(0)}€
          </p>
          <p className="text-xs text-[#9CA3AF]">
            Restant {isAtFloor && '(plancher)'}
          </p>
        </div>
      </div>

      {/* Floor info */}
      <div className="flex items-center justify-between text-xs text-[#9CA3AF] px-1">
        <span>Plancher: {poolFloor.toFixed(0)}€ ({poolFloorPercent}%)</span>
        <span>Coût/joueur: {costPerPlayer}€</span>
      </div>

      {/* Transaction List */}
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="h-4 w-4 text-[#D4AF37]" />
        <h4 className="text-sm font-medium text-[#D4AF37]">
          Utilisateurs de la Cagnotte ({poolUsers.length})
        </h4>
      </div>
      
      <ScrollArea className="h-[200px]">
        <div className="space-y-2 pr-2">
          {poolUsers.map((choice) => (
            <div 
              key={choice.id} 
              className="flex items-center justify-between p-3 bg-[#2D3748]/50 rounded-lg border border-[#D4AF37]/10"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#D4AF37]">{choice.player_number}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {getPlayerName(choice.player_number)}
                    </span>
                    {isBot(choice.player_number) && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">🤖</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                    <span>Entrée: {choice.tokens_entering ?? 0}💎</span>
                    {choice.has_illegal_tokens && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">Contrebande</Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-red-400" />
                <span className="text-red-400 font-bold">-{costPerPlayer}€</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
