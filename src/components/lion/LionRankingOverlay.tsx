import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LionPlayerAvatar } from './presentation/LionPlayerAvatar';
import { Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface Player {
  id: string;
  name: string;
  avatarUrl?: string | null;
  score: number;
}

interface LionRankingOverlayProps {
  open: boolean;
  onClose: () => void;
  playerA: Player | null;
  playerB: Player | null;
  currentTurn: number;
  totalTurns: number;
}

export function LionRankingOverlay({ 
  open, 
  onClose, 
  playerA, 
  playerB,
  currentTurn,
  totalTurns
}: LionRankingOverlayProps) {
  if (!playerA || !playerB) return null;

  const players = [playerA, playerB].sort((a, b) => b.score - a.score);
  const isLeading = players[0].score > players[1].score;
  const isTied = players[0].score === players[1].score;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-gradient-to-b from-amber-950 to-amber-900 border-amber-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-300">
            <Trophy className="h-5 w-5" />
            Classement - Tour {currentTurn}/{totalTurns}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {players.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.15 }}
              className={`flex items-center gap-4 p-4 rounded-xl ${
                index === 0 && isLeading 
                  ? 'bg-amber-800/60 border-2 border-amber-500 lion-glow' 
                  : 'bg-amber-900/40 border border-amber-700'
              }`}
            >
              {/* Rank */}
              <div className={`text-3xl font-bold ${
                index === 0 ? 'text-amber-400' : 'text-amber-600'
              }`}>
                {index === 0 ? '🥇' : '🥈'}
              </div>

              {/* Avatar */}
              <LionPlayerAvatar 
                name={player.name} 
                avatarUrl={player.avatarUrl} 
                size="lg" 
                className={index === 0 && isLeading ? 'ring-amber-400' : ''}
              />

              {/* Info */}
              <div className="flex-1">
                <p className={`font-bold ${
                  index === 0 ? 'text-amber-200 text-lg' : 'text-amber-300'
                }`}>
                  {player.name}
                </p>
                <p className={`text-2xl font-bold ${
                  index === 0 ? 'text-amber-400' : 'text-amber-500'
                }`}>
                  {player.score} <span className="text-sm">PVic</span>
                </p>
              </div>
            </motion.div>
          ))}

          {/* Status */}
          <div className="text-center pt-4 border-t border-amber-700/50">
            {isTied ? (
              <p className="text-amber-400 font-medium">⚖️ Égalité parfaite !</p>
            ) : (
              <p className="text-amber-300">
                <span className="font-bold">{players[0].name}</span> mène de{' '}
                <span className="text-amber-400 font-bold">
                  {players[0].score - players[1].score} PVic
                </span>
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
