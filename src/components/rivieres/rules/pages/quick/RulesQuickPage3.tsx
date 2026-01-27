import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Users, Zap, Star } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';

// Import clan images
import maisonKeryndes from '@/assets/clans/maison-keryndes.png';
import maisonRoyale from '@/assets/clans/maison-royale.png';

interface RulesQuickPage3Props {
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

const CLANS_PREVIEW = [
  { 
    name: 'Maison des Keryndes', 
    image: maisonKeryndes, 
    power: 'Canot de secours ou réduction de danger',
    color: 'blue'
  },
  { 
    name: 'Maison Royale', 
    image: maisonRoyale, 
    power: 'Trésor royal : bonus de jetons au début de la partie',
    color: 'amber'
  },
];

export function RulesQuickPage3({ context, replayNonce }: RulesQuickPage3Props) {
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
          Danger & Clans
        </h1>
        <p className="text-[#9CA3AF]">Maîtrisez le danger et exploitez les pouvoirs des clans</p>
      </motion.div>

      {/* Danger section */}
      <motion.div
        variants={itemVariants}
        className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"
      >
        <h2 className="text-red-400 font-bold text-lg mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Le Danger
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Zap className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-[#E8E8E8] font-medium">Valeur aléatoire</p>
              <p className="text-[#9CA3AF] text-sm">
                Le MJ lance des dés pour déterminer le danger de chaque niveau.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-[#E8E8E8] font-medium">Protection par les mises</p>
              <p className="text-[#9CA3AF] text-sm">
                Si la somme des mises ≥ danger, le niveau est passé avec succès.
              </p>
            </div>
          </div>
          
          <div className="bg-red-500/20 rounded-lg p-3 text-center">
            <p className="text-red-400 font-bold">
              Mises totales &lt; Danger = CHAVIREMENT
            </p>
          </div>
        </div>
      </motion.div>

      {/* Clans preview */}
      <motion.div variants={itemVariants}>
        <h2 className="text-[#D4AF37] font-bold text-lg mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Les Clans (aperçu)
        </h2>
        
        <div className="grid sm:grid-cols-2 gap-3">
          {CLANS_PREVIEW.map((clan, index) => (
            <motion.div
              key={clan.name}
              variants={itemVariants}
              className={`bg-[#1a1f2e] border border-${clan.color}-500/30 rounded-lg p-4 text-center`}
            >
              <div className="w-16 h-16 mx-auto mb-3 rounded-full overflow-hidden bg-[#0B1020] border-2 border-[#D4AF37]/30">
                <img 
                  src={clan.image} 
                  alt={clan.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-white font-bold text-sm mb-1">{clan.name}</h3>
              <p className="text-[#9CA3AF] text-xs">{clan.power}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick summary */}
      <motion.div
        variants={itemVariants}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-5"
      >
        <h2 className="text-[#D4AF37] font-bold mb-3 flex items-center gap-2">
          <Star className="h-5 w-5" />
          Résumé express
        </h2>
        <ul className="text-[#E8E8E8] text-sm space-y-2">
          <li>• <strong>3 manches</strong> de 5 niveaux = 15 niveaux (9 à réussir pour éviter pénalités)</li>
          <li>• Chaque niveau : décision → mise → confrontation</li>
          <li>• <strong>RESTER</strong> = gain si niveau 5 réussi</li>
          <li>• <strong>DESCENDRE</strong> = gain si chavirement</li>
          <li>• Les clans offrent des <strong>avantages uniques</strong></li>
        </ul>
      </motion.div>
    </motion.div>
  );
}
