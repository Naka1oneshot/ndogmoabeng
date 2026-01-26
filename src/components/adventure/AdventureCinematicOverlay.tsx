import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Users } from 'lucide-react';
import { CLANS_DATA } from '@/data/ndogmoabengData';

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

export type CinematicSequence = 
  | 'INTRO'
  | 'GUIDE_CHOICE'
  | 'PRE_RIVIERES'
  | 'TRANSITION_1'
  | 'PRE_FORET'
  | 'TRANSITION_2'
  | 'PRE_SHERIFF'
  | 'TRANSITION_3'
  | 'PRE_INFECTION'
  | 'END';

interface AdventureCinematicOverlayProps {
  open: boolean;
  sequence: CinematicSequence[];
  onClose: () => void;
  onReplay: () => void;
  isHost?: boolean;
  onBroadcastReplay?: () => void;
}

// Sequence content configuration
const SEQUENCE_CONTENT: Record<CinematicSequence, { title: string; subtitle?: string; duration: number }> = {
  INTRO: { 
    title: 'La Carte Trouvée', 
    subtitle: 'Une aventure au cœur de Ndogmoabeng',
    duration: 4000 
  },
  GUIDE_CHOICE: { 
    title: 'Les Guides du Village', 
    subtitle: 'Cinq clans pourront vous accompagner',
    duration: 8000 
  },
  PRE_RIVIERES: { 
    title: 'Les Rivières du Nord', 
    subtitle: 'Votre voyage commence sur les eaux tumultueuses...',
    duration: 3500 
  },
  TRANSITION_1: { 
    title: 'Transition', 
    subtitle: 'Le voyage continue...',
    duration: 2500 
  },
  PRE_FORET: { 
    title: 'La Forêt de Ndogmoabeng', 
    subtitle: 'La traversée des ombres vous attend...',
    duration: 3500 
  },
  TRANSITION_2: { 
    title: 'Transition', 
    subtitle: 'Aux portes du Centre...',
    duration: 2500 
  },
  PRE_SHERIFF: { 
    title: 'Le Shérif de Ndogmoabeng', 
    subtitle: 'Le contrôle des portes du Centre...',
    duration: 3500 
  },
  TRANSITION_3: { 
    title: 'Transition', 
    subtitle: 'Le village est en danger...',
    duration: 2500 
  },
  PRE_INFECTION: { 
    title: 'Infection à Ndogmoabeng', 
    subtitle: 'La contamination a commencé...',
    duration: 3500 
  },
  END: { 
    title: 'Fin de l\'Aventure', 
    subtitle: 'La carte a révélé ses secrets...',
    duration: 5000 
  },
};

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

// Clan card for GUIDE_CHOICE sequence
function ClanCard({ clanId, index }: { clanId: string; index: number }) {
  const clan = CLANS_DATA.find(c => c.id === clanId);
  const image = clanImages[clanId];

  if (!clan) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.9 }}
      transition={{ delay: index * 0.3, duration: 0.6, ease: 'easeOut' }}
      className="bg-gradient-to-b from-[#1A1510]/90 to-[#0F0D08]/90 rounded-lg border border-[#D4AF37]/40 p-4 flex flex-col items-center text-center max-w-[180px]"
    >
      <div className="w-20 h-20 mb-3 flex items-center justify-center">
        <img 
          src={image} 
          alt={clan.name} 
          className="w-full h-full object-contain"
        />
      </div>
      <h4 className="font-display text-sm text-[#D4AF37] mb-1">{clan.name}</h4>
      <p className="text-xs text-[#9CA3AF] mb-2 line-clamp-2">{clan.description}</p>
      <p className="text-xs text-[#D4AF37]/80 italic">"{clan.devise}"</p>
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
}: AdventureCinematicOverlayProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSequence = sequence[currentIndex];
  const content = currentSequence ? SEQUENCE_CONTENT[currentSequence] : null;

  // Auto-advance timer
  useEffect(() => {
    if (!open || !content) return;

    timerRef.current = setTimeout(() => {
      if (currentIndex < sequence.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // Auto-close after last sequence
        onClose();
      }
    }, content.duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [open, currentIndex, content, sequence.length, onClose]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open]);

  const handleReplay = useCallback(() => {
    setCurrentIndex(0);
    onReplay();
  }, [onReplay]);

  const handleBroadcastReplay = useCallback(() => {
    if (onBroadcastReplay) {
      setCurrentIndex(0);
      onBroadcastReplay();
    }
  }, [onBroadcastReplay]);

  if (!open || !currentSequence || !content) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="cinematic-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
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
        <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center max-w-4xl">
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
                className="font-display text-4xl md:text-6xl text-[#D4AF37] mb-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                {content.title}
              </motion.h1>

              {/* Subtitle */}
              {content.subtitle && (
                <motion.p
                  className="text-lg md:text-xl text-[#E8E8E8]/80 mb-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  {content.subtitle}
                </motion.p>
              )}

              {/* Special content for GUIDE_CHOICE */}
              {currentSequence === 'GUIDE_CHOICE' && (
                <motion.div
                  className="flex flex-wrap justify-center gap-4 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  {GUIDE_CLANS.map((clanId, index) => (
                    <ClanCard key={clanId} clanId={clanId} index={index} />
                  ))}
                </motion.div>
              )}

              {/* Progress indicator */}
              <motion.div
                className="flex items-center gap-2 mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {sequence.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? 'bg-[#D4AF37] w-4' : 'bg-[#D4AF37]/30'
                    }`}
                  />
                ))}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Control buttons */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 z-20">
          {/* Skip/Close button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1510]/80 border border-[#D4AF37]/30 text-[#E8E8E8]/80 hover:text-[#E8E8E8] hover:bg-[#1A1510] transition-all"
          >
            <X className="w-4 h-4" />
            <span>Passer</span>
          </motion.button>

          {/* Replay button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            onClick={handleReplay}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1510]/80 border border-[#D4AF37]/30 text-[#D4AF37]/80 hover:text-[#D4AF37] hover:bg-[#1A1510] transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Relancer</span>
          </motion.button>

          {/* Broadcast replay button (host only) */}
          {isHost && onBroadcastReplay && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              onClick={handleBroadcastReplay}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/30 transition-all"
            >
              <Users className="w-4 h-4" />
              <span>Relancer pour tous</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
