import { useEffect, useState, useCallback } from 'react';
import { Skull, Heart, AlertTriangle, Trophy, User, Timer } from 'lucide-react';
import { INFECTION_COLORS, INFECTION_ROLE_LABELS } from '../InfectionTheme';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface DeadPlayer {
  player_number: number;
  display_name: string;
  role_code: string | null;
  team_code: string | null;
  avatar_url?: string | null;
  pvic?: number | null;
}

interface InfectionDeathRevealAnimationProps {
  show: boolean;
  deadPlayers: DeadPlayer[];
  manche: number;
  onComplete: () => void;
}

export function InfectionDeathRevealAnimation({ 
  show, 
  deadPlayers, 
  manche,
  onComplete 
}: InfectionDeathRevealAnimationProps) {
  const [phase, setPhase] = useState<'hidden' | 'suspense' | 'counting' | 'reveal' | 'details' | 'exiting'>('hidden');
  const [countDisplay, setCountDisplay] = useState(0);
  const [revealedIndex, setRevealedIndex] = useState(-1);
  
  const deathCount = deadPlayers.length;

  // Roles that show PVic immediately
  const pvicRoles = ['BA', 'KK', 'AE'];
  const shouldShowPvic = (roleCode: string | null) => {
    return roleCode && pvicRoles.includes(roleCode);
  };

  const startAnimation = useCallback(() => {
    if (!show) return;
    
    setPhase('suspense');
    setCountDisplay(0);
    setRevealedIndex(-1);

    // Phase 1: Suspense (2s)
    const suspenseTimer = setTimeout(() => {
      setPhase('counting');
      
      // Phase 2: Count up dramatically (1.5s)
      if (deathCount === 0) {
        // Skip counting if no deaths
        setTimeout(() => setPhase('reveal'), 500);
      } else {
        let count = 0;
        const countInterval = setInterval(() => {
          count++;
          setCountDisplay(count);
          if (count >= deathCount) {
            clearInterval(countInterval);
            setTimeout(() => setPhase('reveal'), 800);
          }
        }, Math.max(150, 1000 / deathCount));
      }
    }, 2000);

    return () => {
      clearTimeout(suspenseTimer);
    };
  }, [show, deathCount]);

  useEffect(() => {
    if (show) {
      startAnimation();
    } else {
      setPhase('hidden');
    }
  }, [show, startAnimation]);

  // Reveal players one by one
  useEffect(() => {
    if (phase === 'reveal' && deathCount > 0) {
      const revealTimer = setTimeout(() => {
        if (revealedIndex < deathCount - 1) {
          setRevealedIndex(prev => prev + 1);
        } else {
          // All revealed, move to details phase
          setTimeout(() => setPhase('details'), 1000);
        }
      }, revealedIndex === -1 ? 500 : 1200);

      return () => clearTimeout(revealTimer);
    }
  }, [phase, revealedIndex, deathCount]);

  // Exit after details phase
  useEffect(() => {
    if (phase === 'details') {
      const exitTimer = setTimeout(() => {
        setPhase('exiting');
        setTimeout(() => {
          setPhase('hidden');
          onComplete();
        }, 500);
      }, Math.max(3000, deathCount * 1500));

      return () => clearTimeout(exitTimer);
    }
    
    if (phase === 'reveal' && deathCount === 0) {
      // No deaths - quick exit
      const exitTimer = setTimeout(() => {
        setPhase('exiting');
        setTimeout(() => {
          setPhase('hidden');
          onComplete();
        }, 500);
      }, 2500);

      return () => clearTimeout(exitTimer);
    }
  }, [phase, deathCount, onComplete]);

  if (phase === 'hidden') return null;

  const getRoleConfig = (roleCode: string | null) => {
    if (!roleCode || !INFECTION_ROLE_LABELS[roleCode]) {
      return { name: 'Inconnu', short: '?', color: INFECTION_COLORS.textMuted };
    }
    return INFECTION_ROLE_LABELS[roleCode];
  };

  const renderSuspensePhase = () => (
    <div className="text-center animate-scale-in">
      <Timer 
        className="h-20 w-20 sm:h-28 sm:w-28 mx-auto mb-6 animate-pulse" 
        style={{ color: INFECTION_COLORS.accent }}
      />
      <h1 
        className="text-3xl sm:text-5xl font-bold mb-4 animate-pulse"
        style={{ color: INFECTION_COLORS.textPrimary }}
      >
        RÉSOLUTION MANCHE {manche}
      </h1>
      <p className="text-xl sm:text-2xl" style={{ color: INFECTION_COLORS.textSecondary }}>
        Comptage des victimes...
      </p>
      <div className="mt-8 flex justify-center gap-2">
        {[0, 1, 2].map(i => (
          <div 
            key={i}
            className="w-3 h-3 rounded-full animate-bounce"
            style={{ 
              backgroundColor: INFECTION_COLORS.accent,
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>
    </div>
  );

  const renderCountingPhase = () => (
    <div className="text-center">
      <Skull 
        className="h-24 w-24 sm:h-32 sm:w-32 mx-auto mb-6 animate-pulse" 
        style={{ color: deathCount > 0 ? INFECTION_COLORS.danger : INFECTION_COLORS.success }}
      />
      <div 
        className="text-8xl sm:text-[12rem] font-bold mb-4 transition-all duration-300"
        style={{ 
          color: deathCount > 0 ? INFECTION_COLORS.danger : INFECTION_COLORS.success,
          textShadow: `0 0 60px ${deathCount > 0 ? INFECTION_COLORS.danger : INFECTION_COLORS.success}80`
        }}
      >
        {countDisplay}
      </div>
      <p className="text-2xl sm:text-3xl" style={{ color: INFECTION_COLORS.textSecondary }}>
        {countDisplay === 1 ? 'VICTIME' : 'VICTIMES'}
      </p>
    </div>
  );

  const renderNoDeathsPhase = () => (
    <div className="text-center animate-scale-in">
      <div className="relative inline-block">
        <Heart 
          className="h-24 w-24 sm:h-32 sm:w-32 mx-auto mb-6 animate-pulse" 
          style={{ color: INFECTION_COLORS.success }}
        />
      </div>
      <h1 
        className="text-4xl sm:text-6xl font-bold mb-4"
        style={{ color: INFECTION_COLORS.success, textShadow: `0 0 20px ${INFECTION_COLORS.success}60` }}
      >
        AUCUNE VICTIME
      </h1>
      <p className="text-xl sm:text-2xl" style={{ color: INFECTION_COLORS.textSecondary }}>
        Le village respire... pour l'instant
      </p>
    </div>
  );

  const renderRevealPhase = () => {
    if (deathCount === 0) return renderNoDeathsPhase();

    return (
      <div className="text-center px-4 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 
            className="text-3xl sm:text-5xl font-bold mb-2"
            style={{ color: INFECTION_COLORS.danger }}
          >
            {deathCount === 1 ? 'UNE VICTIME' : `${deathCount} VICTIMES`}
          </h1>
          <p className="text-lg" style={{ color: INFECTION_COLORS.textSecondary }}>
            Manche {manche}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6">
          {deadPlayers.map((player, index) => {
            const roleConfig = getRoleConfig(player.role_code);
            const isRevealed = index <= revealedIndex;
            const showPvic = shouldShowPvic(player.role_code) && player.pvic;

            return (
              <div
                key={player.player_number}
                className={`
                  flex items-center gap-4 p-4 sm:p-6 rounded-xl transition-all duration-500
                  ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
                `}
                style={{ 
                  backgroundColor: isRevealed ? `${INFECTION_COLORS.bgCard}` : 'transparent',
                  border: isRevealed ? `2px solid ${INFECTION_COLORS.danger}40` : 'none',
                  transitionDelay: `${index * 100}ms`
                }}
              >
                {/* Avatar */}
                <div className="relative">
                  <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2" style={{ borderColor: INFECTION_COLORS.danger }}>
                    {player.avatar_url ? (
                      <AvatarImage src={player.avatar_url} alt={player.display_name} />
                    ) : null}
                    <AvatarFallback style={{ backgroundColor: INFECTION_COLORS.bgSecondary, color: INFECTION_COLORS.textPrimary }}>
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <Skull 
                    className="absolute -bottom-1 -right-1 h-6 w-6 p-1 rounded-full"
                    style={{ backgroundColor: INFECTION_COLORS.danger, color: INFECTION_COLORS.bgPrimary }}
                  />
                </div>

                {/* Player Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono" style={{ color: INFECTION_COLORS.textMuted }}>
                      #{player.player_number}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold" style={{ color: INFECTION_COLORS.textPrimary }}>
                      {player.display_name}
                    </span>
                  </div>
                  
                  {/* Role Badge - Revealed with delay */}
                  <div 
                    className={`transition-all duration-500 ${isRevealed ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transitionDelay: `${index * 100 + 300}ms` }}
                  >
                    <Badge 
                      className="text-sm px-3 py-1"
                      style={{ 
                        backgroundColor: roleConfig.color,
                        color: '#fff'
                      }}
                    >
                      {roleConfig.short} - {roleConfig.name}
                    </Badge>
                  </div>
                </div>

                {/* PVic for BA, KK, AE */}
                {showPvic && (
                  <div 
                    className={`flex items-center gap-2 transition-all duration-500 ${isRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                    style={{ transitionDelay: `${index * 100 + 600}ms` }}
                  >
                    <Trophy className="h-6 w-6" style={{ color: INFECTION_COLORS.pvic }} />
                    <span 
                      className="text-2xl sm:text-3xl font-bold"
                      style={{ color: INFECTION_COLORS.pvic }}
                    >
                      {player.pvic}
                    </span>
                    <span className="text-sm" style={{ color: INFECTION_COLORS.textMuted }}>PVic</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 overflow-y-auto py-8 ${
        phase === 'exiting' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ 
        backgroundColor: `${INFECTION_COLORS.bgPrimary}F5`
      }}
    >
      <style>
        {`
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 20px ${INFECTION_COLORS.danger}40; }
            50% { box-shadow: 0 0 40px ${INFECTION_COLORS.danger}80; }
          }
        `}
      </style>

      {phase === 'suspense' && renderSuspensePhase()}
      {phase === 'counting' && renderCountingPhase()}
      {(phase === 'reveal' || phase === 'details') && renderRevealPhase()}
    </div>
  );
}
