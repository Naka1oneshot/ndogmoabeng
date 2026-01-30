import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Volume1 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const AUDIO_PATH = '/sounds/generique-carte-trouvee.mp3';
const STORAGE_KEY_MUTED = 'comingSoonMusicMuted';
const STORAGE_KEY_VOLUME = 'comingSoonMusicVolume';

export function ComingSoonAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  // Initialize mute state from localStorage
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
    } catch {
      return false;
    }
  });

  // Initialize volume from localStorage (0-100), default to 30%
  const [volume, setVolume] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
      return stored ? parseInt(stored, 10) : 30;
    } catch {
      return 30;
    }
  });

  // Initialize audio element and attempt autoplay
  useEffect(() => {
    const audio = new Audio(AUDIO_PATH);
    audio.loop = true;
    audio.volume = isMuted ? 0 : volume / 100;
    audioRef.current = audio;

    // Handle audio events
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // No autoplay - wait for user interaction

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update audio when volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
        setHasInteracted(true);
      }
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }, [isPlaying]);

  // Restart from beginning
  const restart = useCallback(async () => {
    if (!audioRef.current) return;
    
    audioRef.current.currentTime = 0;
    try {
      await audioRef.current.play();
      setHasInteracted(true);
    } catch (err) {
      console.error('Audio restart error:', err);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, String(newMuted));
    } catch {
      // localStorage might not be available
    }
  }, [isMuted]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    try {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(newVolume));
    } catch {}
    
    // Unmute if adjusting volume while muted
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
      try {
        localStorage.setItem(STORAGE_KEY_MUTED, 'false');
      } catch {}
    }
  }, [isMuted]);

  // Get appropriate volume icon
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1 }}
      className="fixed bottom-4 right-4 z-50"
    >
      <div className="flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-primary/30 rounded-full px-3 py-2 shadow-lg">
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="p-2 rounded-full bg-primary/20 hover:bg-primary/30 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 text-primary" />
          ) : (
            <Play className="h-4 w-4 text-primary" />
          )}
        </button>

        {/* Restart button */}
        <button
          onClick={restart}
          className="p-2 rounded-full hover:bg-primary/20 transition-colors"
          aria-label="Recommencer"
        >
          <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-primary" />
        </button>

        {/* Volume controls */}
        <div className="relative flex items-center">
          <AnimatePresence>
            {showVolumeSlider && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-2 mr-2 overflow-hidden"
              >
                <Slider
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-20"
                />
                <span className="text-xs font-medium text-muted-foreground min-w-[2rem]">
                  {volume}%
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={() => setShowVolumeSlider(!showVolumeSlider)}
            onDoubleClick={toggleMute}
            className="p-2 rounded-full hover:bg-primary/20 transition-colors"
            aria-label={isMuted ? 'Activer le son' : 'Régler le volume'}
            title="Clic: volume | Double-clic: mute"
          >
            <VolumeIcon className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </button>
        </div>
      </div>

      {/* First interaction prompt - only show if autoplay was blocked */}
      {!hasInteracted && !isPlaying && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full right-0 mb-2 whitespace-nowrap"
        >
          <div className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
            🎵 Cliquez pour activer la musique
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
