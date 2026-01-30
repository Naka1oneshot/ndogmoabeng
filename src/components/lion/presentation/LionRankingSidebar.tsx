import { motion } from 'framer-motion';
import { LionPlayerAvatar } from './LionPlayerAvatar';
import { LionCardDisplay } from '../LionTheme';
import { Trophy } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Player {
  id: string;
  name: string;
  avatarUrl?: string | null;
  score: number;
}

interface TurnResult {
  turnIndex: number;
  winnerId: string | null;
  winnerName: string;
  points: number;
}

interface LionRankingSidebarProps {
  playerA: Player | null;
  playerB: Player | null;
  turnHistory?: TurnResult[];
  activePlayerId?: string;
  dealerCardsA?: number[];
  dealerCardsB?: number[];
  className?: string;
}

export function LionRankingSidebar({ 
  playerA, 
  playerB, 
  turnHistory = [], 
  activePlayerId,
  dealerCardsA = [],
  dealerCardsB = [],
  className 
}: LionRankingSidebarProps) {
  if (!playerA || !playerB) return null;

  const players = [playerA, playerB].sort((a, b) => b.score - a.score);
  const isLeading = players[0].score > players[1].score;

  // Determine which dealer deck to show based on active player
  // The dealer deck belongs to the active player
  const currentDealerPlayerId = activePlayerId;
  const currentDealerCards = currentDealerPlayerId === playerA.id ? dealerCardsA : dealerCardsB;
  const currentDealerName = currentDealerPlayerId === playerA.id ? playerA.name : playerB.name;

  // All cards in a deck (0-10)
  const allCards = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  return (
    <div className={`bg-amber-950/80 border-l border-amber-700 flex flex-col ${className}`}>
      {/* Spacer for top controls */}
      <div className="h-16" />
      
      {/* Dealer Cards Section */}
      {activePlayerId && (
        <div className="px-4 pb-4 border-b border-amber-700/50">
          <p className="text-amber-400 text-sm font-medium mb-2">
            Deck Croupier ({currentDealerName})
          </p>
          <div className="flex flex-wrap gap-1 justify-center">
            {allCards.map((card) => {
              const isPlayed = currentDealerCards.includes(card);
              return (
                <motion.div
                  key={card}
                  initial={isPlayed ? { scale: 0.8, opacity: 0.4 } : { scale: 1, opacity: 1 }}
                  animate={isPlayed ? { scale: 0.8, opacity: 0.4 } : { scale: 1, opacity: 1 }}
                  className={`relative ${isPlayed ? 'grayscale' : ''}`}
                >
                  <LionCardDisplay value={card} size="xs" />
                  {isPlayed && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-red-500 text-lg font-bold">✕</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          <p className="text-amber-500 text-xs text-center mt-2">
            {currentDealerCards.length}/11 jouées
          </p>
        </div>
      )}

      {/* Ranking Header */}
      <div className="flex items-center gap-2 p-4 pb-2">
        <Trophy className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-bold text-amber-300">Classement</h3>
      </div>

      {/* Player Rankings */}
      <div className="space-y-3 px-4">
        {players.map((player, index) => (
          <motion.div
            key={player.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className={`flex items-center gap-3 p-2 rounded-lg ${
              index === 0 && isLeading ? 'bg-amber-900/50 border border-amber-600' : ''
            }`}
          >
            <span className={`text-lg font-bold ${
              index === 0 ? 'text-amber-400' : 'text-amber-600'
            }`}>
              {index + 1}
            </span>
            
            <LionPlayerAvatar 
              name={player.name} 
              avatarUrl={player.avatarUrl} 
              size="sm" 
            />
            
            <div className="flex-1 min-w-0">
              <p className="text-amber-200 font-medium truncate text-sm">
                {player.name}
              </p>
            </div>
            
            <motion.span
              key={player.score}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className={`text-lg font-bold ${
                index === 0 ? 'text-amber-300' : 'text-amber-500'
              }`}
            >
              {player.score}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {/* Score Difference */}
      {isLeading && (
        <div className="mx-4 mt-4 pt-4 border-t border-amber-700/50 text-center">
          <p className="text-amber-400 text-sm">Avance</p>
          <p className="text-2xl font-bold text-amber-300">
            +{players[0].score - players[1].score}
          </p>
        </div>
      )}

      {/* Turn History */}
      {turnHistory.length > 0 && (
        <div className="flex-1 mt-4 border-t border-amber-700/50 flex flex-col min-h-0">
          <p className="text-amber-400 text-sm font-medium px-4 pt-3 pb-2">Historique</p>
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-1">
              {turnHistory.slice().reverse().map((result) => (
                <motion.div
                  key={result.turnIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between text-xs py-1 border-b border-amber-800/30"
                >
                  <span className="text-amber-500">T{result.turnIndex}</span>
                  <span className="text-amber-200 truncate mx-2 flex-1">
                    {result.points === 0 ? '—' : result.winnerName}
                  </span>
                  <span className={`font-bold ${result.points > 0 ? 'text-green-400' : 'text-amber-600'}`}>
                    {result.points > 0 ? `+${result.points}` : '0'}
                  </span>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
