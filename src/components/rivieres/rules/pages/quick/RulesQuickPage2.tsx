import { motion } from 'framer-motion';
import { Ship, Anchor, Coins, AlertTriangle, ArrowDown, Users } from 'lucide-react';
import { RivieresRulesContextData, computePayoutPerPlayer } from '../../useRivieresRulesContext';

interface RulesQuickPage2Props {
  context: RivieresRulesContextData;
  replayNonce: number;
  onNavigate?: (index: number) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function RulesQuickPage2({ context, replayNonce }: RulesQuickPage2Props) {
  // Example calculation
  const examplePot = 350;
  const exampleRestants = 5;
  const exampleGain = computePayoutPerPlayer(examplePot, exampleRestants);
  
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
          Décisions & Répartition
        </h1>
        <p className="text-[#9CA3AF]">Comprendre les choix et leurs conséquences</p>
      </motion.div>

      {/* Two choices side by side */}
      <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
        {/* RESTER */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center">
              <Ship className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-blue-400 font-bold">RESTER</h3>
              <span className="text-xs text-blue-400/70">sur le bateau</span>
            </div>
          </div>
          <ul className="text-sm text-[#E8E8E8] space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-400">+</span>
              Vous participez au partage de la cagnotte
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">+</span>
              Plus de potentiel de gains
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400">-</span>
              Risque de tout perdre si chavirement
            </li>
          </ul>
        </div>

        {/* DESCENDRE */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center">
              <Anchor className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-amber-400 font-bold">DESCENDRE</h3>
              <span className="text-xs text-amber-400/70">à terre</span>
            </div>
          </div>
          <ul className="text-sm text-[#E8E8E8] space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-400">+</span>
              Sécurisez vos jetons actuels
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">+</span>
              Si chavirement, vous partagez la cagnotte
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400">-</span>
              Pas de gains si le niveau passe
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Payout example */}
      <motion.div
        variants={itemVariants}
        className="bg-[#1a1f2e] rounded-xl p-6 border border-[#D4AF37]/20"
      >
        <h2 className="text-[#D4AF37] font-bold text-lg mb-4 flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Exemple de répartition
        </h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          {/* Pot */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37] flex items-center justify-center mb-2">
              <span className="text-[#D4AF37] font-bold">{examplePot}</span>
            </div>
            <span className="text-[#9CA3AF] text-xs">Cagnotte</span>
          </motion.div>
          
          <ArrowDown className="h-6 w-6 text-[#D4AF37] rotate-0 sm:-rotate-90" />
          
          {/* Players */}
          <motion.div variants={itemVariants} className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-2">
              {Array.from({ length: exampleRestants }).map((_, i) => (
                <div 
                  key={i}
                  className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center"
                >
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
              ))}
            </div>
            <span className="text-[#9CA3AF] text-xs">{exampleRestants} restants</span>
          </motion.div>
          
          <span className="text-white font-bold text-xl">=</span>
          
          {/* Result */}
          <motion.div
            variants={itemVariants}
            className="bg-green-500/20 border border-green-500/30 rounded-lg px-6 py-4 text-center"
          >
            <span className="text-green-400 font-bold text-2xl">{exampleGain}</span>
            <span className="text-green-400/70 text-sm block">jetons/joueur</span>
          </motion.div>
        </div>
        
        <p className="text-[#9CA3AF] text-xs text-center mt-4">
          Formule : floor(cagnotte ÷ nombre de restants) = floor({examplePot} ÷ {exampleRestants}) = {exampleGain}
        </p>
      </motion.div>

      {/* Warning */}
      <motion.div
        variants={itemVariants}
        className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4"
      >
        <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-red-400 font-bold text-sm">Attention au chavirement !</p>
          <p className="text-[#E8E8E8] text-sm">
            Si le danger dépasse les mises totales, le bateau chavire. 
            Les joueurs qui ont DESCENDU à ce niveau partagent la cagnotte. 
            Les restants n'obtiennent rien.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
