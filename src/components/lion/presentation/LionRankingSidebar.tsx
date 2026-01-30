import { motion } from 'framer-motion';
import { LionPlayerAvatar } from './LionPlayerAvatar';
import { Trophy } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  avatarUrl?: string | null;
  score: number;
}

interface LionRankingSidebarProps {
  playerA: Player | null;
  playerB: Player | null;
  className?: string;
}

export function LionRankingSidebar({ playerA, playerB, className }: LionRankingSidebarProps) {
  if (!playerA || !playerB) return null;

  const players = [playerA, playerB].sort((a, b) => b.score - a.score);
  const leader = players[0];
  const isLeading = players[0].score > players[1].score;

  return (
    <div className={`bg-amber-950/80 border-l border-amber-700 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-amber-400" />
        <h3 className="text-lg font-bold text-amber-300">Classement</h3>
      </div>

      <div className="space-y-3">
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
        <div className="mt-4 pt-4 border-t border-amber-700/50 text-center">
          <p className="text-amber-400 text-sm">Avance</p>
          <p className="text-2xl font-bold text-amber-300">
            +{players[0].score - players[1].score}
          </p>
        </div>
      )}
    </div>
  );
}
