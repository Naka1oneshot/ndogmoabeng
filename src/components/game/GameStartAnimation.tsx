import { Ship, Trees, Waves, Volume2, VolumeX, Volume1, Syringe, Skull } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Slider } from '@/components/ui/slider';

interface GameStartAnimationProps {
  gameType: 'FORET' | 'RIVIERES' | 'INFECTION';
  playerCount?: number;
  playerName?: string;
  isMJ?: boolean;
}

export function GameStartAnimation({ 
  gameType, 
  playerCount, 
  playerName,
  isMJ = false 
}: GameStartAnimationProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isForet = gameType === 'FORET';
  const isInfection = gameType === 'INFECTION';
  
  // Initialize mute state from localStorage
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('gameStartSoundMuted') === 'true';
    } catch {
      return false;
    }
  });

  // Initialize volume from localStorage (0-100)
  const [volume, setVolume] = useState(() => {
    try {
      const stored = localStorage.getItem('gameStartSoundVolume');
      return stored ? parseInt(stored, 10) : 50;
    } catch {
      return 50;
    }
  });

  // Show/hide volume slider
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  // Play sound effect on mount
  useEffect(() => {
    const soundFile = isForet ? '/sounds/forest-wind.mp3' : isInfection ? '/sounds/combat-hit.mp3' : '/sounds/foghorn.mp3';
    
    try {
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = volume / 100;
      audioRef.current.muted = isMuted;
      audioRef.current.play().catch(err => {
        console.log('Audio autoplay blocked:', err);
      });
    } catch (err) {
      console.log('Audio not available:', err);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isForet, isInfection]); // Only re-run on game type change, not on volume/mute changes

  // Update audio when volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Update audio when mute changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Handle mute toggle and persist to localStorage
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try {
      localStorage.setItem('gameStartSoundMuted', String(newMuted));
    } catch {
      // localStorage might not be available
    }
  };

  // Handle volume change and persist to localStorage
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    try {
      localStorage.setItem('gameStartSoundVolume', String(newVolume));
    } catch {
      // localStorage might not be available
    }
    // Unmute if adjusting volume while muted
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
      try {
        localStorage.setItem('gameStartSoundMuted', 'false');
      } catch {}
    }
  };

  // Get appropriate volume icon
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  
  // Theme colors based on game type
  const bgColor = isForet ? 'bg-[#1a2f1a]' : isInfection ? 'bg-[#0B0E14]' : 'bg-[#0B1020]';
  const accentColor = isForet ? 'text-[#4ADE80]' : isInfection ? 'text-[#B00020]' : 'text-[#D4AF37]';
  const accentColorFaded = isForet ? 'text-[#4ADE80]/30' : isInfection ? 'text-[#B00020]/30' : 'text-[#D4AF37]/30';
  const gradientColor = isForet ? 'from-[#2d4a2d]/30' : isInfection ? 'from-[#B00020]/10' : 'from-[#1B4D3E]/30';
  
  const Icon = isForet ? Trees : isInfection ? Syringe : Ship;
  const WaveIcon = isForet ? Trees : isInfection ? Skull : Waves;
  
  const title = isMJ 
    ? 'Partie lancée !' 
    : 'La partie commence !';
  
  const subtitle = isMJ
    ? `${playerCount || 0} joueur${(playerCount || 0) > 1 ? 's' : ''} embarqué${(playerCount || 0) > 1 ? 's' : ''}`
    : playerName 
      ? `Préparez-vous, ${playerName}...`
      : 'Préparez-vous...';

  const flavorText = isForet
    ? 'En route vers la forêt mystérieuse...'
    : isInfection 
      ? "L'infection se propage..."
      : "Que l'aventure commence...";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${bgColor}`}>
      {/* Volume controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {showVolumeSlider && (
          <div 
            className={`flex items-center gap-2 px-3 py-2 rounded-full ${
              isForet 
                ? 'bg-[#2d4a2d]/70' 
                : isInfection 
                  ? 'bg-[#1A2235]/70'
                  : 'bg-[#1B4D3E]/70'
            }`}
          >
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-24"
            />
            <span className={`text-xs font-medium min-w-[2rem] ${isForet ? 'text-[#4ADE80]' : isInfection ? 'text-[#B00020]' : 'text-[#D4AF37]'}`}>
              {volume}%
            </span>
          </div>
        )}
        <button
          onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          onDoubleClick={toggleMute}
          className={`p-3 rounded-full transition-all duration-200 hover:scale-110 ${
            isForet 
              ? 'bg-[#2d4a2d]/50 hover:bg-[#2d4a2d]/70 text-[#4ADE80]' 
              : isInfection 
                ? 'bg-[#1A2235]/50 hover:bg-[#1A2235]/70 text-[#B00020]'
                : 'bg-[#1B4D3E]/50 hover:bg-[#1B4D3E]/70 text-[#D4AF37]'
          }`}
          aria-label={isMuted ? 'Activer le son' : 'Régler le volume'}
          title="Clic: volume | Double-clic: mute"
        >
          <VolumeIcon className="h-6 w-6" />
        </button>
      </div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t ${gradientColor} to-transparent`} />
        <div className="absolute bottom-10 left-1/4 animate-wave">
          <WaveIcon className={`h-16 w-16 ${accentColorFaded}`} />
        </div>
        <div className="absolute bottom-20 right-1/4 animate-wave" style={{ animationDelay: '0.5s' }}>
          <WaveIcon className={`h-12 w-12 ${accentColorFaded.replace('/30', '/20')}`} />
        </div>
        <div className="absolute bottom-5 left-1/2 animate-wave" style={{ animationDelay: '1s' }}>
          <WaveIcon className={`h-20 w-20 ${accentColorFaded.replace('/30', '/40')}`} />
        </div>
      </div>

      {/* Main content */}
      <div className="relative text-center z-10 px-6">
        {/* Pulsing icon */}
        <div className="mb-8 animate-game-start-pulse">
          <div className="relative inline-block">
            <Icon className={`h-24 w-24 ${accentColor}`} />
            <div className="absolute inset-0 animate-ping">
              <Icon className={`h-24 w-24 ${accentColorFaded}`} />
            </div>
          </div>
        </div>

        {/* Text animations */}
        <h1 className={`text-4xl md:text-5xl font-bold ${accentColor} mb-4 animate-slide-up-fade`}>
          {title}
        </h1>
        <p className="text-xl text-[#E8E8E8] animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
          {subtitle}
        </p>
        <p className="text-lg text-[#9CA3AF] mt-2 animate-slide-up-fade" style={{ animationDelay: '0.6s' }}>
          {flavorText}
        </p>
      </div>
    </div>
  );
}
