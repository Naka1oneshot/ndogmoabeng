import { useEffect, useState } from 'react';
import { Ship, Anchor, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PlayerDecision {
  id: string;
  display_name: string;
  avatar_url: string | null;
  decision: 'RESTE' | 'DESCENDS';
}

interface RivieresPlayerSortAnimationProps {
  players: PlayerDecision[];
  onComplete: () => void;
}

export function RivieresPlayerSortAnimation({
  players,
  onComplete,
}: RivieresPlayerSortAnimationProps) {
  const [phase, setPhase] = useState<'intro' | 'sorting' | 'done'>('intro');
  const [visiblePlayers, setVisiblePlayers] = useState<string[]>([]);

  const stayingPlayers = players.filter(p => p.decision === 'RESTE');
  const descendingPlayers = players.filter(p => p.decision === 'DESCENDS');

  useEffect(() => {
    let intervalRef: NodeJS.Timeout | null = null;
    
    // Phase 1: Intro (1s)
    const introTimer = setTimeout(() => setPhase('sorting'), 1000);

    // Phase 2: Animate players one by one
    const sortingTimer = setTimeout(() => {
      let index = 0;
      intervalRef = setInterval(() => {
        if (index < players.length) {
          setVisiblePlayers(prev => [...prev, players[index].id]);
          index++;
        } else {
          if (intervalRef) clearInterval(intervalRef);
        }
      }, 150);
    }, 1000);

    // Phase 3: Done (after all players + 1.5s)
    const totalAnimationTime = 1000 + (players.length * 150) + 1500;
    const doneTimer = setTimeout(() => setPhase('done'), totalAnimationTime);

    // Complete
    const completeTimer = setTimeout(onComplete, totalAnimationTime + 500);

    return () => {
      clearTimeout(introTimer);
      clearTimeout(sortingTimer);
      clearTimeout(doneTimer);
      clearTimeout(completeTimer);
      if (intervalRef) clearInterval(intervalRef);
    };
  }, [players, onComplete]);

  // Play sound on intro
  useEffect(() => {
    if (phase === 'intro') {
      const audio = new Audio('/sounds/forest-wind.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    }
  }, [phase]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]" />

      {/* Animated water waves at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4 overflow-hidden opacity-30">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-wave text-blue-500/40"
            style={{
              left: `${i * 15}%`,
              bottom: `${5 + (i % 3) * 10}%`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            ~~~~~
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-8">
        {/* Title */}
        {phase === 'intro' && (
          <div className="text-center animate-scale-in">
            <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">Répartition des joueurs</h1>
            <p className="text-xl text-[#9CA3AF]">Qui reste dans le bateau ?</p>
          </div>
        )}

        {/* Sorting animation */}
        {(phase === 'sorting' || phase === 'done') && (
          <div className="grid grid-cols-2 gap-8 animate-fade-in">
            {/* Dans le bateau (RESTE) */}
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Ship className="h-8 w-8 text-blue-400" />
                <h2 className="text-2xl font-bold text-blue-400">Dans le bateau</h2>
                <span className="ml-auto text-xl font-bold text-blue-300">
                  {visiblePlayers.filter(id => stayingPlayers.some(p => p.id === id)).length}
                </span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {stayingPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg bg-blue-900/40 transition-all duration-300 ${
                      visiblePlayers.includes(p.id) 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-0 -translate-x-8'
                    }`}
                    style={{ transitionDelay: `${idx * 50}ms` }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-blue-500/30 text-blue-300 text-sm">
                        {p.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[#E8E8E8] font-medium">{p.display_name}</span>
                    <Ship className="h-5 w-5 text-blue-400 ml-auto" />
                  </div>
                ))}
                {stayingPlayers.length === 0 && phase === 'done' && (
                  <div className="text-center text-blue-300/60 py-8">
                    Personne ne reste
                  </div>
                )}
              </div>
            </div>

            {/* A terre (DESCENDS) */}
            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Anchor className="h-8 w-8 text-green-400" />
                <h2 className="text-2xl font-bold text-green-400">A terre</h2>
                <span className="ml-auto text-xl font-bold text-green-300">
                  {visiblePlayers.filter(id => descendingPlayers.some(p => p.id === id)).length}
                </span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {descendingPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg bg-green-900/40 transition-all duration-300 ${
                      visiblePlayers.includes(p.id) 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-0 translate-x-8'
                    }`}
                    style={{ transitionDelay: `${idx * 50}ms` }}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-green-500/30 text-green-300 text-sm">
                        {p.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[#E8E8E8] font-medium">{p.display_name}</span>
                    <Anchor className="h-5 w-5 text-green-400 ml-auto" />
                  </div>
                ))}
                {descendingPlayers.length === 0 && phase === 'done' && (
                  <div className="text-center text-green-300/60 py-8">
                    Personne ne descend
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
