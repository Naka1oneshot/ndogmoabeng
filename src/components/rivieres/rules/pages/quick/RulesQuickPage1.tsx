import { motion } from 'framer-motion';
import { Ship, Target, Coins, ArrowRight } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';

interface RulesQuickPage1Props {
  context: RivieresRulesContextData;
  replayNonce: number;
  onNavigate?: (index: number) => void;
}

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

export function RulesQuickPage1({ context, replayNonce }: RulesQuickPage1Props) {
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
        <div className="inline-flex items-center gap-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-6 py-2 mb-4">
          <Ship className="h-6 w-6 text-[#D4AF37]" />
          <span className="text-[#D4AF37] font-bold text-lg">Les Rivières de Ndogmoabeng</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Objectif & Cycle de jeu
        </h1>
        <p className="text-[#9CA3AF]">Apprenez les bases en 2 minutes</p>
      </motion.div>

      {/* Objective */}
      <motion.div
        variants={itemVariants}
        className="bg-[#1a1f2e] rounded-xl p-6 border border-[#D4AF37]/20"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0">
            <Target className="h-6 w-6 text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-[#D4AF37] font-bold text-lg mb-2">Objectif</h2>
            <p className="text-[#E8E8E8]">
              Accumulez un maximum de <span className="text-[#D4AF37] font-bold">jetons</span> en 
              naviguant sur les rivières dangereuses de Ndogmoabeng.
            </p>
            <p className="text-[#9CA3AF] text-sm mt-2">
              Restez sur le bateau pour gagner gros, mais attention au chavirement !
            </p>
          </div>
        </div>
      </motion.div>

      {/* Game cycle */}
      <motion.div variants={itemVariants}>
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Coins className="h-5 w-5 text-[#D4AF37]" />
          Cycle de jeu (3 manches × 5 niveaux = 15 niveaux)
        </h2>
        
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Step 1 */}
          <motion.div
            variants={itemVariants}
            className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center">1</span>
              <span className="text-blue-400 font-bold">Décision</span>
            </div>
            <p className="text-[#E8E8E8] text-sm">
              Choisissez de <strong>RESTER</strong> sur le bateau ou de <strong>DESCENDRE</strong> à terre.
            </p>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            variants={itemVariants}
            className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-sm font-bold flex items-center justify-center">2</span>
              <span className="text-amber-400 font-bold">Mise</span>
            </div>
            <p className="text-[#E8E8E8] text-sm">
              Si vous restez, misez des jetons. Ils rejoignent la <strong>cagnotte</strong>.
            </p>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            variants={itemVariants}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center">3</span>
              <span className="text-red-400 font-bold">Confrontation</span>
            </div>
            <p className="text-[#E8E8E8] text-sm">
              Le <strong>danger</strong> est révélé. Si mises totales ≥ danger, le niveau est passé !
            </p>
          </motion.div>

          {/* Step 4 */}
          <motion.div
            variants={itemVariants}
            className="bg-green-500/10 border border-green-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-green-500 text-white text-sm font-bold flex items-center justify-center">4</span>
              <span className="text-green-400 font-bold">Distribution</span>
            </div>
            <p className="text-[#E8E8E8] text-sm">
              <strong>Niveau 5 réussi :</strong> les restants partagent la cagnotte + bonus 100.<br/>
              <strong>Chavirement :</strong> les descendus partagent la cagnotte.
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Quick tip */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4"
      >
        <ArrowRight className="h-5 w-5 text-[#D4AF37] flex-shrink-0" />
        <p className="text-[#E8E8E8] text-sm">
          <span className="text-[#D4AF37] font-bold">Astuce :</span> 15 niveaux total, 9 à réussir pour éviter des pénalités. 
          La cagnotte n'est distribuée qu'au niveau 5 ou en cas de chavirement !
        </p>
      </motion.div>
    </motion.div>
  );
}
