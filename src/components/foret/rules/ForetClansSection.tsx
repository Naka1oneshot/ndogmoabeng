import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, Crown, Sword, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Import clan images
import maisonRoyale from '@/assets/clans/maison-royale.png';
import akande from '@/assets/clans/akande.png';
import sourcesAkila from '@/assets/clans/sources-akila.png';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface ClanInfo {
  id: string;
  name: string;
  image: string;
  icon: typeof Crown;
  iconColor: string;
  devise: string;
  description: string;
  advantages: string[];
}

const FORET_CLANS: ClanInfo[] = [
  {
    id: 'royaux',
    name: 'Maison Royale',
    image: maisonRoyale,
    icon: Crown,
    iconColor: 'text-yellow-400',
    devise: "L'histoire s'écrit ici.",
    description: 'Gouvernent le village, archives officielles et cérémonies.',
    advantages: [
      'Jetons de départ ×1.5 (150 au lieu de 100)',
    ],
  },
  {
    id: 'akande',
    name: 'Akandé',
    image: akande,
    icon: Sword,
    iconColor: 'text-red-400',
    devise: 'Tenir ou mourir.',
    description: 'Armée de Ndogmoabeng, prêts au sacrifice.',
    advantages: [
      'Arme par défaut = 4 dégâts (au lieu de 2)',
    ],
  },
  {
    id: 'akila',
    name: 'Les Sources d\'Akila',
    image: sourcesAkila,
    icon: FlaskConical,
    iconColor: 'text-cyan-400',
    devise: 'Mesurer pour guérir.',
    description: 'Science, soin… transformer l\'inconnu en protocole.',
    advantages: [
      'Réduction des coûts boutique',
      'Accès exclusif au "Sniper Akila" (6 dégâts)',
    ],
  },
];

interface ForetClansSectionProps {
  replayNonce: number;
}

export function ForetClansSection({ replayNonce }: ForetClansSectionProps) {
  const [mobileIndex, setMobileIndex] = useState(0);

  const handlePrev = () => {
    setMobileIndex((prev) => (prev === 0 ? FORET_CLANS.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setMobileIndex((prev) => (prev === FORET_CLANS.length - 1 ? 0 : prev + 1));
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
        <p className="text-[#9CA3AF]">
          Chaque clan dispose d'avantages uniques dans La Forêt
        </p>
      </motion.div>

      {/* Desktop: 3 cards grid */}
      <div className="hidden md:block">
        <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-4">
          {FORET_CLANS.map((clan) => (
            <ClanCard key={clan.id} clan={clan} />
          ))}
        </motion.div>
      </div>

      {/* Tablet: 2+1 layout */}
      <div className="hidden sm:block md:hidden">
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {FORET_CLANS.slice(0, 2).map((clan) => (
              <ClanCard key={clan.id} clan={clan} compact />
            ))}
          </div>
          <ClanCard clan={FORET_CLANS[2]} />
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
              <ClanCard clan={FORET_CLANS[mobileIndex]} />
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Dots */}
            <div className="flex gap-2">
              {FORET_CLANS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setMobileIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === mobileIndex ? 'bg-emerald-400 w-4' : 'bg-emerald-400/30'
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Note */}
      <motion.div
        variants={itemVariants}
        className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center"
      >
        <p className="text-[#9CA3AF] text-sm">
          Le clan de chaque joueur est déterminé au début de la partie et influence ses capacités tout au long du jeu.
        </p>
      </motion.div>
    </motion.div>
  );
}

function ClanCard({ clan, compact = false }: { clan: ClanInfo; compact?: boolean }) {
  const IconComponent = clan.icon;
  
  return (
    <div className={`bg-[#1a1f2e] border border-emerald-500/20 rounded-xl ${compact ? 'p-4' : 'p-5'} flex flex-col`}>
      <div className={`flex items-center gap-3 ${compact ? 'mb-2' : 'mb-4'}`}>
        <div className={`${compact ? 'w-12 h-12' : 'w-14 h-14'} rounded-full overflow-hidden bg-[#0B1020] border-2 border-emerald-500/30 flex-shrink-0`}>
          <img
            src={clan.image}
            alt={clan.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <IconComponent className={`h-4 w-4 ${clan.iconColor} flex-shrink-0`} />
            <h3 className={`text-white font-bold ${compact ? 'text-sm' : 'text-base'} truncate`}>
              {clan.name}
            </h3>
          </div>
          <p className="text-emerald-400 text-xs italic truncate">"{clan.devise}"</p>
        </div>
      </div>

      {!compact && (
        <p className="text-[#9CA3AF] text-sm mb-3">{clan.description}</p>
      )}

      <div className="space-y-1.5 mt-auto">
        {clan.advantages.map((advantage, i) => (
          <div key={i} className="flex items-start gap-2">
            <Star className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className={`text-[#E8E8E8] ${compact ? 'text-xs' : 'text-sm'}`}>
              {advantage}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
