import { useCallback, useRef } from 'react';

type SoundType = 'attack' | 'kill' | 'hit' | 'damage';

const SOUND_FILES: Record<SoundType, string> = {
  attack: '/sounds/combat-sword.mp3',
  kill: '/sounds/combat-kill.mp3',
  hit: '/sounds/combat-hit.mp3',
  damage: '/sounds/combat-hit.mp3',
};

const STORAGE_KEY_MUTED = 'gameStartSoundMuted';
const STORAGE_KEY_VOLUME = 'gameStartSoundVolume';

export function useGameSounds() {
  const audioCache = useRef<Map<SoundType, HTMLAudioElement>>(new Map());

  const getVolume = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
      return stored ? parseInt(stored, 10) / 100 : 0.5;
    } catch {
      return 0.5;
    }
  }, []);

  const isMuted = useCallback(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
    } catch {
      return false;
    }
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (isMuted()) return;

    try {
      // Get or create audio element
      let audio = audioCache.current.get(type);
      
      if (!audio) {
        audio = new Audio(SOUND_FILES[type]);
        audioCache.current.set(type, audio);
      }

      // Reset and play
      audio.currentTime = 0;
      audio.volume = getVolume();
      audio.play().catch(err => {
        console.log('Audio playback blocked:', err);
      });
    } catch (err) {
      console.log('Audio not available:', err);
    }
  }, [getVolume, isMuted]);

  const playAttack = useCallback(() => playSound('attack'), [playSound]);
  const playKill = useCallback(() => playSound('kill'), [playSound]);
  const playHit = useCallback(() => playSound('hit'), [playSound]);
  const playDamage = useCallback(() => playSound('damage'), [playSound]);

  // Play multiple sounds in sequence with delay
  const playCombatSequence = useCallback(async (kills: number, hits: number) => {
    if (isMuted()) return;

    // Play attack sound first
    playAttack();

    // Play hit sounds with slight delay
    for (let i = 0; i < Math.min(hits, 3); i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      playHit();
    }

    // Play kill sounds if any
    for (let i = 0; i < Math.min(kills, 3); i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      playKill();
    }
  }, [isMuted, playAttack, playHit, playKill]);

  return {
    playSound,
    playAttack,
    playKill,
    playHit,
    playDamage,
    playCombatSequence,
  };
}
