import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Volume1, Shield, Skull, Target, Eye, FlaskConical, UserX, User } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface InfectionRoleRevealAnimationProps {
  roleCode: string;
  roleName: string;
  teamName: string;
  victoryCondition: string;
  playerName: string;
  onComplete: () => void;
}

// Role visual configurations
const ROLE_CONFIG: Record<string, { 
  icon: React.ElementType; 
  color: string; 
  bgGlow: string;
  emoji: string;
}> = {
  'PS': { icon: Skull, color: '#B00020', bgGlow: 'rgba(176, 0, 32, 0.3)', emoji: '🦠' },
  'PV': { icon: Skull, color: '#B00020', bgGlow: 'rgba(176, 0, 32, 0.3)', emoji: '💀' },
  'BA': { icon: Target, color: '#2AB3A6', bgGlow: 'rgba(42, 179, 166, 0.3)', emoji: '🔫' },
  'OC': { icon: Eye, color: '#2AB3A6', bgGlow: 'rgba(42, 179, 166, 0.3)', emoji: '👁️' },
  'SY': { icon: FlaskConical, color: '#2AB3A6', bgGlow: 'rgba(42, 179, 166, 0.3)', emoji: '🧪' },
  'AE': { icon: UserX, color: '#D4AF37', bgGlow: 'rgba(212, 175, 55, 0.3)', emoji: '🕵️' },
  'SC': { icon: User, color: '#6B7280', bgGlow: 'rgba(107, 114, 128, 0.3)', emoji: '👤' },
  'CV': { icon: Shield, color: '#6B7280', bgGlow: 'rgba(107, 114, 128, 0.3)', emoji: '💉' },
};

export function InfectionRoleRevealAnimation({
  roleCode,
  roleName,
  teamName,
  victoryCondition,
  playerName,
  onComplete,
}: InfectionRoleRevealAnimationProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<'intro' | 'reveal' | 'details' | 'fadeout'>('intro');
  
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('gameStartSoundMuted') === 'true';
    } catch {
      return false;
    }
  });

  const [volume, setVolume] = useState(() => {
    try {
      const stored = localStorage.getItem('gameStartSoundVolume');
      return stored ? parseInt(stored, 10) : 50;
    } catch {
      return 50;
    }
  });

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const config = ROLE_CONFIG[roleCode] || ROLE_CONFIG['SC'];
  const RoleIcon = config.icon;

  // Play sound and manage animation phases
  useEffect(() => {
    try {
      audioRef.current = new Audio('/sounds/combat-hit.mp3');
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = isMuted;
      audioRef.current.play().catch(err => {
        console.log('Audio autoplay blocked:', err);
      });
    } catch (err) {
      console.log('Audio not available:', err);
    }

    // Animation timeline
    const introTimer = setTimeout(() => setPhase('reveal'), 1500);
    const detailsTimer = setTimeout(() => setPhase('details'), 3000);
    const fadeoutTimer = setTimeout(() => setPhase('fadeout'), 7000);
    const completeTimer = setTimeout(() => onComplete(), 8000);

    return () => {
      clearTimeout(introTimer);
      clearTimeout(detailsTimer);
      clearTimeout(fadeoutTimer);
      clearTimeout(completeTimer);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [onComplete]);

  // Update audio when volume/mute changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try {
      localStorage.setItem('gameStartSoundMuted', String(newMuted));
    } catch {}
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    try {
      localStorage.setItem('gameStartSoundVolume', String(newVolume));
    } catch {}
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
      try {
        localStorage.setItem('gameStartSoundMuted', 'false');
      } catch {}
    }
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0B0E14] transition-opacity duration-1000 ${
        phase === 'fadeout' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background glow */}
      <div 
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: phase === 'intro' 
            ? 'radial-gradient(circle at center, rgba(30, 30, 40, 0.5) 0%, transparent 70%)'
            : `radial-gradient(circle at center, ${config.bgGlow} 0%, transparent 70%)`,
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full animate-float-particle"
            style={{
              backgroundColor: config.color,
              opacity: 0.3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Volume controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {showVolumeSlider && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#1A2235]/70">
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24"
            />
            <span className="text-xs font-medium min-w-[2rem]" style={{ color: config.color }}>
              {volume}%
            </span>
          </div>
        )}
        <button
          onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          onDoubleClick={toggleMute}
          className="p-3 rounded-full transition-all duration-200 hover:scale-110 bg-[#1A2235]/50 hover:bg-[#1A2235]/70"
          style={{ color: config.color }}
          aria-label={isMuted ? 'Activer le son' : 'Régler le volume'}
          title="Clic: volume | Double-clic: mute"
        >
          <VolumeIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        className="absolute bottom-8 right-8 text-[#6B7280] hover:text-[#EAEAF2] transition-colors text-sm z-10"
      >
        Passer →
      </button>

      {/* Main content */}
      <div className="relative text-center z-10 px-6 max-w-lg">
        {/* Intro phase */}
        <div className={`transition-all duration-700 ${
          phase === 'intro' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 absolute inset-0'
        }`}>
          <p className="text-2xl text-[#9CA3AF] animate-pulse">
            {playerName}, votre destin est scellé...
          </p>
        </div>

        {/* Reveal phase */}
        <div className={`transition-all duration-700 ${
          phase === 'reveal' || phase === 'details' || phase === 'fadeout' 
            ? 'opacity-100 scale-100' 
            : 'opacity-0 scale-50'
        }`}>
          {/* Role icon with glow effect */}
          <div className="mb-6 relative inline-block">
            <div 
              className="absolute inset-0 blur-xl animate-pulse"
              style={{ backgroundColor: config.bgGlow }}
            />
            <div 
              className="relative p-6 rounded-full border-2 animate-role-reveal"
              style={{ 
                borderColor: config.color,
                boxShadow: `0 0 30px ${config.bgGlow}, inset 0 0 20px ${config.bgGlow}`,
              }}
            >
              <span className="text-6xl">{config.emoji}</span>
            </div>
          </div>

          {/* Role name */}
          <h1 
            className="text-4xl md:text-5xl font-bold mb-2 animate-slide-up-fade"
            style={{ color: config.color }}
          >
            {roleName}
          </h1>

          {/* Team badge */}
          <div 
            className="inline-block px-4 py-1 rounded-full text-sm font-medium mb-6 animate-slide-up-fade"
            style={{ 
              animationDelay: '0.3s',
              backgroundColor: `${config.color}20`,
              color: config.color,
              border: `1px solid ${config.color}50`,
            }}
          >
            Équipe: {teamName}
          </div>

          {/* Victory condition - appears in details phase */}
          <div className={`transition-all duration-700 ${
            phase === 'details' || phase === 'fadeout' 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-4'
          }`}>
            <div 
              className="mt-4 p-4 rounded-lg border"
              style={{ 
                backgroundColor: `${config.color}10`,
                borderColor: `${config.color}30`,
              }}
            >
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                <div className="text-left">
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: config.color }}>
                    Objectif de victoire
                  </p>
                  <p className="text-sm text-[#EAEAF2]/80">
                    {victoryCondition}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for custom animations */}
      <style>{`
        @keyframes float-particle {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.6;
          }
        }
        
        @keyframes role-reveal {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(10deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
        .animate-float-particle {
          animation: float-particle 5s ease-in-out infinite;
        }
        
        .animate-role-reveal {
          animation: role-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
}
