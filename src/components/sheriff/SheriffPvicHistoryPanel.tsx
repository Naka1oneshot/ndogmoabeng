import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trophy, ArrowUp, ArrowDown, Minus, Search, Wallet } from 'lucide-react';

interface PlayerChoice {
  id: string;
  player_number: number;
  visa_choice: string | null;
  visa_cost_applied: number;
  victory_points_delta: number;
}

interface Duel {
  id: string;
  duel_order: number;
  player1_number: number;
  player2_number: number;
  player1_vp_delta: number;
  player2_vp_delta: number;
  player1_searches: boolean | null;
  player2_searches: boolean | null;
  status: string;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  is_bot?: boolean;
  pvic?: number;
}

interface PvicTransaction {
  id: string;
  playerNumber: number;
  playerName: string;
  isBot: boolean;
  type: 'visa' | 'duel_search' | 'duel_caught';
  delta: number;
  description: string;
  duelOrder?: number;
}

interface SheriffPvicHistoryPanelProps {
  choices: PlayerChoice[];
  duels: Duel[];
  players: Player[];
}

export function SheriffPvicHistoryPanel({
  choices,
  duels,
  players,
}: SheriffPvicHistoryPanelProps) {
  const getPlayerName = (playerNum: number): string => {
    const player = players.find(p => p.player_number === playerNum);
    return player?.display_name || `Joueur ${playerNum}`;
  };

  const isBot = (playerNum: number): boolean => {
    const player = players.find(p => p.player_number === playerNum);
    return player?.is_bot || false;
  };

  // Build transaction list from choices and duels
  const transactions: PvicTransaction[] = [];

  // Add visa cost transactions (VICTORY_POINTS choice)
  choices.forEach((choice) => {
    if (choice.visa_choice === 'VICTORY_POINTS' && choice.visa_cost_applied > 0) {
      transactions.push({
        id: `visa-${choice.id}`,
        playerNumber: choice.player_number,
        playerName: getPlayerName(choice.player_number),
        isBot: isBot(choice.player_number),
        type: 'visa',
        delta: -Math.round(choice.visa_cost_applied * 10) / 10, // Visa costs PVic
        description: 'Visa payé en PVic',
      });
    }
  });

  // Add duel resolution transactions
  duels.filter(d => d.status === 'RESOLVED').forEach((duel) => {
    // Player 1 VP change
    if (duel.player1_vp_delta !== 0) {
      transactions.push({
        id: `duel-p1-${duel.id}`,
        playerNumber: duel.player1_number,
        playerName: getPlayerName(duel.player1_number),
        isBot: isBot(duel.player1_number),
        type: duel.player1_vp_delta < 0 ? 'duel_search' : 'duel_caught',
        delta: duel.player1_vp_delta,
        description: duel.player1_searches 
          ? (duel.player1_vp_delta < 0 ? 'Fouille d\'un légal' : 'Contrebandier attrapé')
          : (duel.player1_vp_delta < 0 ? 'Pris avec contrebande' : 'Légal passé'),
        duelOrder: duel.duel_order,
      });
    }

    // Player 2 VP change
    if (duel.player2_vp_delta !== 0) {
      transactions.push({
        id: `duel-p2-${duel.id}`,
        playerNumber: duel.player2_number,
        playerName: getPlayerName(duel.player2_number),
        isBot: isBot(duel.player2_number),
        type: duel.player2_vp_delta < 0 ? 'duel_search' : 'duel_caught',
        delta: duel.player2_vp_delta,
        description: duel.player2_searches 
          ? (duel.player2_vp_delta < 0 ? 'Fouille d\'un légal' : 'Contrebandier attrapé')
          : (duel.player2_vp_delta < 0 ? 'Pris avec contrebande' : 'Légal passé'),
        duelOrder: duel.duel_order,
      });
    }
  });

  // Calculate stats
  const totalLost = transactions.filter(t => t.delta < 0).reduce((sum, t) => sum + t.delta, 0);
  const totalGained = transactions.filter(t => t.delta > 0).reduce((sum, t) => sum + t.delta, 0);
  const netChange = totalLost + totalGained;

  // Sort by type then by player number
  transactions.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'visa' ? -1 : b.type === 'visa' ? 1 : 0;
    }
    return a.playerNumber - b.playerNumber;
  });

  if (transactions.length === 0) {
    return (
      <div className="text-center text-[#9CA3AF] py-4 text-sm">
        Aucune transaction PVic pour cette session
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 text-center p-3 bg-[#1A1F2C] rounded-lg border border-amber-500/20">
        <div>
          <p className="text-lg font-bold text-red-400">{totalLost}</p>
          <p className="text-xs text-[#9CA3AF]">Perdus</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-400">+{totalGained}</p>
          <p className="text-xs text-[#9CA3AF]">Gagnés</p>
        </div>
        <div>
          <p className={`text-lg font-bold ${netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {netChange >= 0 ? '+' : ''}{netChange}
          </p>
          <p className="text-xs text-[#9CA3AF]">Net</p>
        </div>
      </div>

      {/* Transaction count by type */}
      <div className="flex items-center gap-4 text-xs text-[#9CA3AF] px-1">
        <span className="flex items-center gap-1">
          <Wallet className="h-3 w-3" />
          Visas: {transactions.filter(t => t.type === 'visa').length}
        </span>
        <span className="flex items-center gap-1">
          <Search className="h-3 w-3" />
          Duels: {transactions.filter(t => t.type !== 'visa').length}
        </span>
      </div>

      {/* Transaction List */}
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h4 className="text-sm font-medium text-amber-400">
          Transactions PVic ({transactions.length})
        </h4>
      </div>
      
      <ScrollArea className="h-[250px]">
        <div className="space-y-2 pr-2">
          {transactions.map((tx) => (
            <div 
              key={tx.id} 
              className="flex items-center justify-between p-3 bg-[#2D3748]/50 rounded-lg border border-amber-500/10"
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  tx.type === 'visa' 
                    ? 'bg-purple-500/20' 
                    : tx.delta < 0 
                      ? 'bg-red-500/20' 
                      : 'bg-green-500/20'
                }`}>
                  {tx.type === 'visa' ? (
                    <Wallet className="h-4 w-4 text-purple-400" />
                  ) : tx.delta < 0 ? (
                    <ArrowDown className="h-4 w-4 text-red-400" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-green-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9CA3AF]">#{tx.playerNumber}</span>
                    <span className="text-sm font-medium text-white">
                      {tx.playerName}
                    </span>
                    {tx.isBot && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">🤖</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                    <span>{tx.description}</span>
                    {tx.duelOrder && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        Duel #{tx.duelOrder}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {tx.delta === 0 ? (
                  <Minus className="h-4 w-4 text-gray-400" />
                ) : tx.delta > 0 ? (
                  <ArrowUp className="h-4 w-4 text-green-400" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-400" />
                )}
                <span className={`font-bold ${
                  tx.delta === 0 
                    ? 'text-gray-400' 
                    : tx.delta > 0 
                      ? 'text-green-400' 
                      : 'text-red-400'
                }`}>
                  {tx.delta > 0 ? '+' : ''}{tx.delta}🏆
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
