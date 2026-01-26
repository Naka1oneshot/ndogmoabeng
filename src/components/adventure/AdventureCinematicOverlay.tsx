import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Users, Play, Pause, ChevronRight } from 'lucide-react';
import { CLANS_DATA } from '@/data/ndogmoabengData';
import { SEQUENCE_NARRATIVES, calculateSequenceDuration } from './CinematicSequenceContent';
import type { CinematicSequence } from './CinematicSequenceContent';

// Re-export type for external use
export type { CinematicSequence } from './CinematicSequenceContent';

// Import clan images
import maisonRoyaleImg from '@/assets/clans/maison-royale.png';
import maisonKeryndesImg from '@/assets/clans/maison-keryndes.png';
import akandeImg from '@/assets/clans/akande.png';
import sourcesAkilaImg from '@/assets/clans/sources-akila.png';
import ezkarImg from '@/assets/clans/ezkar.png';

const clanImages: Record<string, string> = {
  'maison-royale': maisonRoyaleImg,
  'maison-keryndes': maisonKeryndesImg,
  'akande': akandeImg,
  'sources-akila': sourcesAkilaImg,
  'ezkar': ezkarImg,
};

const GUIDE_CLANS = ['maison-royale', 'maison-keryndes', 'akande', 'sources-akila', 'ezkar'];

// Key for localStorage to track seen broadcasts
const SEEN_BROADCASTS_KEY = 'ndogmoabeng_seen_cinematics';

interface AdventureCinematicOverlayProps {
  open: boolean;
  sequence: CinematicSequence[];
  onClose: () => void;
  onReplay: () => void;
  isHost?: boolean;
  onBroadcastReplay?: () => void;
  broadcastId?: string;
}

// Floating particles component
function FloatingParticles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#D4AF37]/30"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -50, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Clan card for GUIDE_CHOICE sequence - compact for 2+3 grid layout
function ClanCard({ clanId, index }: { clanId: string; index: number }) {
  const clan = CLANS_DATA.find(c => c.id === clanId);
  const image = clanImages[clanId];

  if (!clan) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ delay: index * 0.12, duration: 0.4, ease: 'easeOut' }}
      className="bg-gradient-to-b from-[#1A1510]/90 to-[#0F0D08]/90 rounded-lg border border-[#D4AF37]/40 p-2 sm:p-3 flex flex-col items-center text-center w-[100px] sm:w-[130px]"
    >
      <div className="w-10 h-10 sm:w-12 sm:h-12 mb-1.5 flex items-center justify-center">
        <img 
          src={image} 
          alt={clan.name} 
          className="w-full h-full object-contain"
        />
      </div>
      <h4 className="font-display text-[10px] sm:text-xs text-[#D4AF37] mb-0.5 leading-tight">{clan.name}</h4>
      <p className="text-[8px] sm:text-[10px] text-[#9CA3AF] line-clamp-2 leading-tight">{clan.description}</p>
    </motion.div>
  );
}

export function AdventureCinematicOverlay({
  open,
  sequence,
  onClose,
  onReplay,
  isHost = false,
  onBroadcastReplay,
  broadcastId,
}: AdventureCinematicOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isSecondView, setIsSecondView] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSequence = sequence[currentIndex];
  const content = currentSequence ? SEQUENCE_NARRATIVES[currentSequence] : null;
  const duration = currentSequence ? calculateSequenceDuration(currentSequence) : 5000;

  // Check if this broadcast was already seen
  useEffect(() => {
    if (open && broadcastId) {
      try {
        const seenBroadcasts = JSON.parse(localStorage.getItem(SEEN_BROADCASTS_KEY) || '[]');
        const hasSeenBefore = seenBroadcasts.includes(broadcastId);
        setIsSecondView(hasSeenBefore);
        
        if (!hasSeenBefore) {
          // Mark as seen
          seenBroadcasts.push(broadcastId);
          // Keep only last 50 to avoid localStorage bloat
          if (seenBroadcasts.length > 50) {
            seenBroadcasts.shift();
          }
          localStorage.setItem(SEEN_BROADCASTS_KEY, JSON.stringify(seenBroadcasts));
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [open, broadcastId]);

  // Auto-advance timer (disabled on second view or when paused)
  useEffect(() => {
    if (!open || !content || isPaused || isSecondView) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    timerRef.current = setTimeout(() => {
      if (currentIndex < sequence.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Auto-close after last sequence
        onClose();
      }
    }, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [open, currentIndex, content, sequence.length, onClose, isPaused, isSecondView, duration]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setIsPaused(false);
    }
  }, [open]);

  const handleReplay = useCallback(() => {
    setCurrentIndex(0);
    setIsPaused(false);
    setIsSecondView(true); // Replays should use manual control
    onReplay();
  }, [onReplay]);

  const handleBroadcastReplay = useCallback(() => {
    if (onBroadcastReplay) {
      setCurrentIndex(0);
      setIsPaused(false);
      onBroadcastReplay();
    }
  }, [onBroadcastReplay]);

  const handleNext = useCallback(() => {
    if (currentIndex < sequence.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, sequence.length, onClose]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  if (!open || !currentSequence || !content) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="cinematic-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0B1020 0%, #1A1510 50%, #0B1020 100%)',
        }}
      >
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              'radial-gradient(ellipse at 30% 30%, rgba(212, 175, 55, 0.15) 0%, transparent 50%)',
              'radial-gradient(ellipse at 70% 70%, rgba(212, 175, 55, 0.15) 0%, transparent 50%)',
              'radial-gradient(ellipse at 30% 70%, rgba(212, 175, 55, 0.15) 0%, transparent 50%)',
              'radial-gradient(ellipse at 70% 30%, rgba(212, 175, 55, 0.15) 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />

        {/* Floating particles */}
        <FloatingParticles />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 text-center max-w-3xl w-full max-h-[80vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSequence}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center"
            >
              {/* Main title */}
              <motion.h1
                className="font-display text-2xl sm:text-4xl md:text-5xl text-[#D4AF37] mb-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                {content.title}
              </motion.h1>

              {/* Narrative text */}
              <motion.div
                className="text-sm sm:text-base md:text-lg text-[#E8E8E8]/90 mb-6 max-w-2xl whitespace-pre-line leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                {content.narrative}
              </motion.div>

              {/* Clan cards for GUIDE_CHOICE - 2+3 grid layout, no scrollbar */}
              {content.showClans && (
                <motion.div
                  className="w-full mt-4 flex flex-col items-center gap-2 sm:gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  {/* Row 1: 2 clans centered */}
                  <div className="flex gap-2 sm:gap-3 justify-center">
                    {GUIDE_CLANS.slice(0, 2).map((clanId, index) => (
                      <ClanCard key={clanId} clanId={clanId} index={index} />
                    ))}
                  </div>
                  {/* Row 2: 3 clans centered */}
                  <div className="flex gap-2 sm:gap-3 justify-center">
                    {GUIDE_CLANS.slice(2, 5).map((clanId, index) => (
                      <ClanCard key={clanId} clanId={clanId} index={index + 2} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Progress indicator */}
              <motion.div
                className="flex items-center gap-2 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {sequence.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? 'bg-[#D4AF37] w-4' : idx < currentIndex ? 'bg-[#D4AF37]/60' : 'bg-[#D4AF37]/30'
                    }`}
                  />
                ))}
              </motion.div>
              
              {/* Manual control indicator for second view */}
              {isSecondView && (
                <motion.p
                  className="text-xs text-[#D4AF37]/60 mt-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  Mode manuel • Utilisez "Suivant" pour avancer
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Control buttons */}
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 flex flex-wrap items-center justify-center gap-2 sm:gap-3 z-20 px-4">
          {/* Skip/Close button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#1A1510]/80 border border-[#D4AF37]/30 text-[#E8E8E8]/80 hover:text-[#E8E8E8] hover:bg-[#1A1510] transition-all text-sm"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Passer</span>
          </motion.button>

          {/* Pause/Play button (first view only) */}
          {!isSecondView && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              onClick={togglePause}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#1A1510]/80 border border-[#D4AF37]/30 text-[#D4AF37]/80 hover:text-[#D4AF37] hover:bg-[#1A1510] transition-all text-sm"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Reprendre</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Pause</span>
                </>
              )}
            </motion.button>
          )}

          {/* Next button (second view or when paused) */}
          {(isSecondView || isPaused) && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 }}
              onClick={handleNext}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/30 transition-all text-sm font-medium"
            >
              <span>Suivant</span>
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </motion.button>
          )}

          {/* Replay button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            onClick={handleReplay}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#1A1510]/80 border border-[#D4AF37]/30 text-[#D4AF37]/80 hover:text-[#D4AF37] hover:bg-[#1A1510] transition-all text-sm"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Relancer</span>
          </motion.button>

          {/* Broadcast replay button (host only) */}
          {isHost && onBroadcastReplay && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              onClick={handleBroadcastReplay}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/30 transition-all text-sm"
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Relancer pour tous</span>
              <span className="sm:hidden">Tous</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
