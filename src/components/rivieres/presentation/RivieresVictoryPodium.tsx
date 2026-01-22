import { useEffect } from 'react';
import { Trophy, Ship, Waves, CheckCircle, XCircle, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import confetti from 'canvas-confetti';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

interface RankedPlayer {
  id: string;
  display_name: string;
  player_number: number | null;
  jetons: number;
  clan: string | null;
  avatar_url: string | null;
  validated_levels: number;
  score_value: number;
  penalty_applied: boolean;
  current_status: string;
}

interface LevelHistory {
  manche: number;
  niveau: number;
  outcome: 'SUCCESS' | 'FAIL';
}

interface RivieresVictoryPodiumProps {
  ranking: RankedPlayer[];
  levelHistory: LevelHistory[];
  onClose: () => void;
}

export function RivieresVictoryPodium({ ranking, levelHistory, onClose }: RivieresVictoryPodiumProps) {
  // Trigger confetti on mount
  useEffect(() => {
    const duration = 5000;
    const end = Date.now() + duration;

    const colors = ['#D4AF37', '#4ADE80', '#60A5FA'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    // Play victory sound
    const audio = new Audio('/sounds/combat-kill.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  }, []);

  // Calculate stats
  const totalLevels = levelHistory.length;
  const successLevels = levelHistory.filter(l => l.outcome === 'SUCCESS').length;
  const failLevels = levelHistory.filter(l => l.outcome === 'FAIL').length;

  const top3 = ranking.slice(0, 3);
  const others = ranking.slice(3);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0B1020] via-[#1B4D3E]/30 to-[#0B1020] overflow-hidden">
      {/* Animated background waves */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 overflow-hidden opacity-20">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-wave"
            style={{ left: `${i * 12}%`, bottom: `${(i % 3) * 20}%`, animationDelay: `${i * 0.2}s` }}
          >
            <Waves className="h-24 w-24 text-[#D4AF37]" />
          </div>
        ))}
      </div>

      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 text-[#9CA3AF] hover:text-white"
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Main content */}
      <div className="relative z-10 h-full flex flex-col items-center pt-8 px-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <img src={logoNdogmoabeng} alt="Logo" className="h-16 w-16" />
          <div className="text-center">
            <h1 className="text-4xl font-bold text-[#D4AF37] flex items-center gap-3">
              <Trophy className="h-10 w-10 animate-bounce" />
              VICTOIRE RIVIÈRES
              <Trophy className="h-10 w-10 animate-bounce" />
            </h1>
            <p className="text-[#9CA3AF] mt-1">Classement Final</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-8 mb-8">
          <div className="bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg px-6 py-3 text-center">
            <div className="text-[#9CA3AF] text-sm">Niveaux joués</div>
            <div className="text-2xl font-bold text-[#D4AF37]">{totalLevels}/15</div>
          </div>
          <div className="bg-[#151B2D] border border-green-500/30 rounded-lg px-6 py-3 text-center">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" /> Réussites
            </div>
            <div className="text-2xl font-bold text-green-400">{successLevels}</div>
          </div>
          <div className="bg-[#151B2D] border border-red-500/30 rounded-lg px-6 py-3 text-center">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="h-4 w-4" /> Échecs
            </div>
            <div className="text-2xl font-bold text-red-400">{failLevels}</div>
          </div>
        </div>

        {/* Podium for top 3 */}
        <div className="flex items-end justify-center gap-4 mb-8">
          {/* 2nd place */}
          {top3[1] && (
            <div className="flex flex-col items-center animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
              <Avatar className="h-20 w-20 border-4 border-gray-300 mb-2">
                <AvatarImage src={top3[1].avatar_url || undefined} />
                <AvatarFallback className="bg-gray-500/20 text-gray-300 text-xl">
                  {top3[1].display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-lg font-medium text-[#E8E8E8] max-w-24 truncate">{top3[1].display_name}</span>
              <span className="text-sm text-gray-400">{top3[1].validated_levels} niv.</span>
              <span className="text-2xl font-bold text-gray-300">{top3[1].score_value} pts</span>
              <div className="h-24 w-24 bg-gray-600 rounded-t-lg flex items-center justify-center mt-2">
                <span className="text-4xl">🥈</span>
              </div>
            </div>
          )}

          {/* 1st place */}
          {top3[0] && (
            <div className="flex flex-col items-center animate-slide-up-fade" style={{ animationDelay: '0.1s' }}>
              <div className="relative">
                <Avatar className="h-28 w-28 border-4 border-[#D4AF37] mb-2">
                  <AvatarImage src={top3[0].avatar_url || undefined} />
                  <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-2xl">
                    {top3[0].display_name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="text-3xl">👑</span>
                </div>
              </div>
              <span className="text-xl font-bold text-[#D4AF37] max-w-28 truncate">{top3[0].display_name}</span>
              <span className="text-sm text-[#9CA3AF]">{top3[0].validated_levels} niveaux</span>
              <span className="text-3xl font-bold text-[#D4AF37]">{top3[0].score_value} pts</span>
              <div className="h-32 w-28 bg-[#D4AF37] rounded-t-lg flex items-center justify-center mt-2">
                <span className="text-5xl">🥇</span>
              </div>
            </div>
          )}

          {/* 3rd place */}
          {top3[2] && (
            <div className="flex flex-col items-center animate-slide-up-fade" style={{ animationDelay: '0.5s' }}>
              <Avatar className="h-16 w-16 border-4 border-amber-600 mb-2">
                <AvatarImage src={top3[2].avatar_url || undefined} />
                <AvatarFallback className="bg-amber-600/20 text-amber-500 text-lg">
                  {top3[2].display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-base font-medium text-[#E8E8E8] max-w-20 truncate">{top3[2].display_name}</span>
              <span className="text-sm text-[#9CA3AF]">{top3[2].validated_levels} niv.</span>
              <span className="text-xl font-bold text-amber-500">{top3[2].score_value} pts</span>
              <div className="h-16 w-20 bg-amber-700 rounded-t-lg flex items-center justify-center mt-2">
                <span className="text-3xl">🥉</span>
              </div>
            </div>
          )}
        </div>

        {/* Rest of rankings */}
        {others.length > 0 && (
          <div className="w-full max-w-2xl bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-4 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <table className="w-full text-sm">
                <thead className="bg-[#0B1020] sticky top-0">
                  <tr>
                    <th className="p-2 text-left text-[#9CA3AF]">Rang</th>
                    <th className="p-2 text-left text-[#9CA3AF]">Joueur</th>
                    <th className="p-2 text-center text-[#9CA3AF]">Niveaux</th>
                    <th className="p-2 text-center text-[#9CA3AF]">Jetons</th>
                    <th className="p-2 text-right text-[#D4AF37]">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((p, idx) => (
                    <tr key={p.id} className="border-t border-[#D4AF37]/10">
                      <td className="p-2 text-[#9CA3AF]">#{idx + 4}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">
                              {p.display_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[#E8E8E8]">{p.display_name}</span>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <span className={p.validated_levels >= 9 ? 'text-[#4ADE80]' : 'text-amber-400'}>
                          {p.validated_levels}
                        </span>
                        {p.penalty_applied && <span className="text-red-400 ml-1">⚠️</span>}
                      </td>
                      <td className="p-2 text-center text-[#4ADE80]">{p.jetons}💎</td>
                      <td className="p-2 text-right font-bold text-[#D4AF37]">{p.score_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* Ship decoration at bottom */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-20">
          <Ship className="h-24 w-24 text-[#D4AF37]" />
        </div>
      </div>
    </div>
  );
}
