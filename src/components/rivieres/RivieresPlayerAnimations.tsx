import { useState, useEffect, useRef } from 'react';
import { Lock, AlertTriangle, Waves, Ship, Anchor, CheckCircle, Skull, Target, Coins, SkipForward } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

// ========== SKIP BUTTON COMPONENT ==========
interface SkipButtonProps {
  onSkip: () => void;
}

function SkipButton({ onSkip }: SkipButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSkip}
      className="fixed bottom-6 right-6 z-[110] text-white/70 hover:text-white hover:bg-white/10 border border-white/20"
    >
      <SkipForward className="h-4 w-4 mr-1" />
      Passer
    </Button>
  );
}

// ========== LOCK ANIMATION ==========
interface RivieresLockPlayerAnimationProps {
  onComplete: () => void;
}

export function RivieresLockPlayerAnimation({ onComplete }: RivieresLockPlayerAnimationProps) {
  const [phase, setPhase] = useState<'tension' | 'lock' | 'done'>('tension');
  const onCompleteRef = useRef(onComplete);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleSkip = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    onCompleteRef.current();
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('lock'), 1500);
    const t2 = setTimeout(() => setPhase('done'), 2500);
    const t3 = setTimeout(() => onCompleteRef.current(), 3000);
    timersRef.current = [t1, t2, t3];

    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const audio = new Audio('/sounds/foghorn.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div 
        className={`absolute inset-0 transition-all duration-500 ${
          phase === 'tension' 
            ? 'bg-gradient-to-br from-red-900/90 via-black to-red-900/90 animate-pulse' 
            : 'bg-black/95'
        }`}
      />

      {phase === 'tension' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <AlertTriangle className="h-24 w-24 text-red-500 animate-ping opacity-30" style={{ animationDuration: '0.8s' }} />
            <AlertTriangle className="h-24 w-24 text-red-400 absolute top-0 left-0 animate-pulse" />
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <p className="text-xl text-red-400 font-bold animate-pulse">
                ⚠️ VERROUILLAGE ⚠️
              </p>
            </div>
          </div>
        </div>
      )}

      {(phase === 'lock' || phase === 'done') && (
        <div className="relative z-10 text-center animate-scale-in">
          <div className="relative inline-block">
            <Lock className="h-20 w-20 text-[#D4AF37] animate-bounce" />
          </div>
          <h1 className="text-3xl font-bold text-[#D4AF37] mt-4 animate-slide-up-fade">
            VERROUILLÉ !
          </h1>
        </div>
      )}

      <SkipButton onSkip={handleSkip} />
    </div>
  );
}

// ========== RESOLVE ANIMATION ==========
interface RivieresResolvePlayerAnimationProps {
  danger: number;
  totalMises: number;
  outcome: 'SUCCESS' | 'FAIL';
  niveau: number;
  manche: number;
  onComplete: () => void;
}

export function RivieresResolvePlayerAnimation({
  danger,
  totalMises,
  outcome,
  niveau,
  manche,
  onComplete,
}: RivieresResolvePlayerAnimationProps) {
  const [phase, setPhase] = useState<'danger' | 'counter' | 'result' | 'done'>('danger');
  const [displayedMises, setDisplayedMises] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const counterRef = useRef<NodeJS.Timeout | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleSkip = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    if (counterRef.current) clearInterval(counterRef.current);
    onCompleteRef.current();
  };

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('counter'), 1200);
    const t2 = setTimeout(() => setPhase('result'), 3000);
    const t3 = setTimeout(() => setPhase('done'), 5000);
    const t4 = setTimeout(() => onCompleteRef.current(), 5500);
    timersRef.current = [t1, t2, t3, t4];

    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (phase === 'counter') {
      const duration = 1800;
      const startTime = Date.now();

      counterRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        
        const fluctuation = progress < 0.8 
          ? Math.floor(Math.random() * totalMises * 1.5)
          : Math.round(totalMises * eased);
        
        setDisplayedMises(fluctuation);

        if (progress >= 1) {
          setDisplayedMises(totalMises);
          if (counterRef.current) clearInterval(counterRef.current);
        }
      }, 50);

      return () => {
        if (counterRef.current) clearInterval(counterRef.current);
      };
    }
  }, [phase, totalMises]);

  useEffect(() => {
    if (phase === 'result') {
      const soundFile = outcome === 'SUCCESS' ? '/sounds/combat-kill.mp3' : '/sounds/foghorn.mp3';
      const audio = new Audio(soundFile);
      audio.volume = 0.4;
      audio.play().catch(() => {});
    }
  }, [phase, outcome]);

  const isSuccess = outcome === 'SUCCESS';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div className={`absolute inset-0 transition-all duration-700 ${
        phase === 'result' || phase === 'done'
          ? (isSuccess ? 'bg-gradient-to-br from-green-900/90 via-[#0B1020] to-green-900/90' : 'bg-gradient-to-br from-red-900/90 via-[#0B1020] to-red-900/90')
          : 'bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]'
      }`} />

      <div className="relative z-10 text-center px-4">
        {phase === 'danger' && (
          <div className="animate-scale-in">
            <Target className="h-12 w-12 text-red-500 mx-auto mb-4 animate-pulse" />
            <h1 className="text-3xl font-bold text-red-400 mb-2">DANGER</h1>
            <div className="text-6xl font-bold text-red-500 animate-pulse">{danger}</div>
            <p className="text-lg text-[#9CA3AF] mt-3">Manche {manche} • Niveau {niveau}</p>
          </div>
        )}

        {phase === 'counter' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <Target className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <div className="text-lg text-red-400">Danger</div>
                <div className="text-4xl font-bold text-red-500">{danger}</div>
              </div>
              <span className="text-2xl font-bold text-[#D4AF37]">VS</span>
              <div className="text-center">
                <Coins className="h-8 w-8 text-[#4ADE80] mx-auto mb-2 animate-spin" />
                <div className="text-lg text-[#4ADE80]">Mises</div>
                <div className={`text-4xl font-bold transition-all ${displayedMises >= danger ? 'text-green-400' : 'text-amber-400'}`}>
                  {displayedMises}
                </div>
              </div>
            </div>
            <p className="text-lg text-[#9CA3AF] mt-6 animate-pulse">Comptage...</p>
          </div>
        )}

        {(phase === 'result' || phase === 'done') && (
          <div className="animate-scale-in">
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-center">
                <div className="text-lg text-red-400">Danger</div>
                <div className="text-3xl font-bold text-red-500">{danger}</div>
              </div>
              <div className="text-xl text-[#9CA3AF]">{isSuccess ? '≤' : '>'}</div>
              <div className="text-center">
                <div className="text-lg text-[#4ADE80]">Mises</div>
                <div className="text-3xl font-bold text-[#4ADE80]">{totalMises}</div>
              </div>
            </div>

            <div className={`flex items-center justify-center gap-3 ${isSuccess ? 'text-green-400' : 'text-red-400'}`}>
              {isSuccess ? (
                <>
                  <CheckCircle className="h-12 w-12 animate-bounce" />
                  <div>
                    <h1 className="text-3xl font-bold">RÉUSSITE !</h1>
                    <p className="text-base mt-1">Le bateau avance</p>
                  </div>
                </>
              ) : (
                <>
                  <Skull className="h-12 w-12 animate-pulse" />
                  <div>
                    <h1 className="text-3xl font-bold">CHAVIREMENT !</h1>
                    <p className="text-base mt-1">Le bateau a coulé</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <SkipButton onSkip={handleSkip} />
    </div>
  );
}

// ========== PLAYER SORT ANIMATION ==========
interface PlayerDecision {
  id: string;
  display_name: string;
  avatar_url: string | null;
  decision: 'RESTE' | 'DESCENDS';
}

interface RivieresPlayerSortPlayerAnimationProps {
  players: PlayerDecision[];
  onComplete: () => void;
}

export function RivieresPlayerSortPlayerAnimation({
  players,
  onComplete,
}: RivieresPlayerSortPlayerAnimationProps) {
  const [phase, setPhase] = useState<'intro' | 'sorting' | 'done'>('intro');
  const [visiblePlayers, setVisiblePlayers] = useState<string[]>([]);
  const onCompleteRef = useRef(onComplete);
  const hasStartedRef = useRef(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Safety fallback: if players array is empty, complete immediately
  useEffect(() => {
    if (players.length === 0) {
      const fallbackTimer = setTimeout(() => onCompleteRef.current(), 100);
      return () => clearTimeout(fallbackTimer);
    }
  }, [players.length]);

  const handleSkip = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    if (intervalRef.current) clearInterval(intervalRef.current);
    onCompleteRef.current();
  };

  const stayingPlayers = players.filter(p => p.decision === 'RESTE');
  const descendingPlayers = players.filter(p => p.decision === 'DESCENDS');

  useEffect(() => {
    if (hasStartedRef.current || players.length === 0) return;
    hasStartedRef.current = true;
    
    const t1 = setTimeout(() => setPhase('sorting'), 800);
    timersRef.current.push(t1);

    const t2 = setTimeout(() => {
      let index = 0;
      intervalRef.current = setInterval(() => {
        if (index < players.length) {
          setVisiblePlayers(prev => [...prev, players[index].id]);
          index++;
        } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 120);
    }, 800);
    timersRef.current.push(t2);

    const totalTime = 800 + (players.length * 120) + 1200;
    const t3 = setTimeout(() => setPhase('done'), totalTime);
    const t4 = setTimeout(() => onCompleteRef.current(), totalTime + 400);
    timersRef.current.push(t3, t4);

    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [players.length]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]" />

      <div className="relative z-10 w-full max-w-2xl px-4">
        {phase === 'intro' && (
          <div className="text-center animate-scale-in">
            <h1 className="text-2xl font-bold text-[#D4AF37] mb-2">Répartition</h1>
            <p className="text-lg text-[#9CA3AF]">Qui reste ? Qui descend ?</p>
          </div>
        )}

        {(phase === 'sorting' || phase === 'done') && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            {/* Dans le bateau */}
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Ship className="h-6 w-6 text-blue-400" />
                <h2 className="text-lg font-bold text-blue-400">Bateau</h2>
                <span className="ml-auto text-lg font-bold text-blue-300">
                  {visiblePlayers.filter(id => stayingPlayers.some(p => p.id === id)).length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {stayingPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg bg-blue-900/40 transition-all duration-300 ${
                      visiblePlayers.includes(p.id) ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                    }`}
                    style={{ transitionDelay: `${idx * 40}ms` }}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-blue-500/30 text-blue-300 text-xs">
                        {p.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[#E8E8E8] text-sm truncate flex-1">{p.display_name}</span>
                  </div>
                ))}
                {stayingPlayers.length === 0 && phase === 'done' && (
                  <div className="text-center text-blue-300/60 py-4 text-sm">Personne</div>
                )}
              </div>
            </div>

            {/* A terre */}
            <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Anchor className="h-6 w-6 text-green-400" />
                <h2 className="text-lg font-bold text-green-400">Terre</h2>
                <span className="ml-auto text-lg font-bold text-green-300">
                  {visiblePlayers.filter(id => descendingPlayers.some(p => p.id === id)).length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {descendingPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg bg-green-900/40 transition-all duration-300 ${
                      visiblePlayers.includes(p.id) ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                    }`}
                    style={{ transitionDelay: `${idx * 40}ms` }}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback className="bg-green-500/30 text-green-300 text-xs">
                        {p.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[#E8E8E8] text-sm truncate flex-1">{p.display_name}</span>
                  </div>
                ))}
                {descendingPlayers.length === 0 && phase === 'done' && (
                  <div className="text-center text-green-300/60 py-4 text-sm">Personne</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <SkipButton onSkip={handleSkip} />
    </div>
  );
}

// ========== MANCHE CHANGE ANIMATION ==========
interface RivieresMancheChangeAnimationProps {
  manche: number;
  onComplete: () => void;
}

export function RivieresMancheChangeAnimation({ manche, onComplete }: RivieresMancheChangeAnimationProps) {
  const onCompleteRef = useRef(onComplete);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const handleSkip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onCompleteRef.current();
  };

  useEffect(() => {
    timerRef.current = setTimeout(() => onCompleteRef.current(), 2500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const audio = new Audio('/sounds/forest-wind.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1020] via-[#151B2D] to-[#0B1020]" />
      
      <div className="absolute inset-0 overflow-hidden opacity-20">
        {Array.from({ length: 6 }).map((_, i) => (
          <Waves 
            key={i} 
            className="absolute h-16 w-16 text-blue-400 animate-wave"
            style={{ 
              left: `${i * 20}%`, 
              top: `${30 + (i % 2) * 40}%`,
              animationDelay: `${i * 0.2}s` 
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center animate-scale-in">
        <Ship className="h-16 w-16 text-[#D4AF37] mx-auto mb-4 animate-bounce" />
        <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">MANCHE {manche}</h1>
        <p className="text-xl text-[#E8E8E8]">Nouvelle traversée !</p>
      </div>

      <SkipButton onSkip={handleSkip} />
    </div>
  );
}
