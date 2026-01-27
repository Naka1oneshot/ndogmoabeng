import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';

// Import clan images
import maisonKeryndes from '@/assets/clans/maison-keryndes.png';
import maisonRoyale from '@/assets/clans/maison-royale.png';

interface RulesPageClansProps {
  context: RivieresRulesContextData;
  replayNonce: number;
  onNavigate?: (index: number) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const CLANS = [
  {
    id: 'keryndes',
    name: 'Maison des Keryndes',
    image: maisonKeryndes,
    devise: 'On part, on revient.',
    description: 'Guides et messagers, maîtres des passages.',
    powers: [
      'Canot de secours : descendre gratuitement après révélation du danger',
      'Réduction de danger : diminue le danger effectif de 2',
    ],
  },
  {
    id: 'royale',
    name: 'Maison Royale',
    image: maisonRoyale,
    devise: "L'histoire s'écrit ici.",
    description: 'Gouvernent le village, archives officielles et cérémonies.',
    powers: [
      'Trésor royal : bonus de jetons au début de la partie',
    ],
  },
];

export function RulesPageClans({ context, replayNonce }: RulesPageClansProps) {
  const [mobileIndex, setMobileIndex] = useState(0);
  
  const handlePrev = () => {
    setMobileIndex((prev) => (prev === 0 ? CLANS.length - 1 : prev - 1));
  };
  
  const handleNext = () => {
    setMobileIndex((prev) => (prev === CLANS.length - 1 ? 0 : prev + 1));
  };
  
  return (
    <motion.div
      key={replayNonce}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Title */}
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Clans & Avantages
        </h1>
        <p className="text-[#9CA3AF]">Chaque clan possède des pouvoirs uniques</p>
      </motion.div>

      {/* Desktop: 2 cards layout */}
      <div className="hidden sm:block">
        <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
          {CLANS.map((clan) => (
            <ClanCard key={clan.id} clan={clan} />
          ))}
        </motion.div>
      </div>

      {/* Mobile: Carousel */}
      <div className="sm:hidden">
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={mobileIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.2 }}
            >
              <ClanCard clan={CLANS[mobileIndex]} />
            </motion.div>
          </AnimatePresence>
          
          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="border-[#D4AF37]/30 text-[#D4AF37]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {/* Dots */}
            <div className="flex gap-2">
              {CLANS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setMobileIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === mobileIndex ? 'bg-[#D4AF37] w-4' : 'bg-[#D4AF37]/30'
                  }`}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="border-[#D4AF37]/30 text-[#D4AF37]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Note */}
      <motion.div
        variants={itemVariants}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4 text-center"
      >
        <p className="text-[#9CA3AF] text-sm">
          Les pouvoirs des clans sont utilisables une fois par manche (sauf indication contraire).
        </p>
      </motion.div>
    </motion.div>
  );
}

function ClanCard({ clan, compact = false }: { clan: typeof CLANS[0]; compact?: boolean }) {
  return (
    <div className={`bg-[#1a1f2e] border border-[#D4AF37]/20 rounded-xl ${compact ? 'p-4' : 'p-5'} flex flex-col`}>
      <div className={`flex items-center gap-3 ${compact ? 'mb-2' : 'mb-4'}`}>
        <div className={`${compact ? 'w-12 h-12' : 'w-14 h-14'} rounded-full overflow-hidden bg-[#0B1020] border-2 border-[#D4AF37]/30 flex-shrink-0`}>
          <img
            src={clan.image}
            alt={clan.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <h3 className={`text-white font-bold ${compact ? 'text-sm' : 'text-base'} truncate`}>{clan.name}</h3>
          <p className="text-[#D4AF37] text-xs italic truncate">"{clan.devise}"</p>
        </div>
      </div>
      
      {!compact && (
        <p className="text-[#9CA3AF] text-sm mb-3">{clan.description}</p>
      )}
      
      <div className="space-y-1 mt-auto">
        {clan.powers.map((power, i) => (
          <div key={i} className="flex items-start gap-2">
            <Star className="h-3 w-3 text-[#D4AF37] mt-0.5 flex-shrink-0" />
            <span className={`text-[#E8E8E8] ${compact ? 'text-xs' : 'text-sm'}`}>{power}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
