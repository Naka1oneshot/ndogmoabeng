import { motion } from 'framer-motion';
import { Coins, Users, Calculator, ArrowDown, Sparkles } from 'lucide-react';
import { RivieresRulesContextData, computePayoutPerPlayer } from '../../useRivieresRulesContext';

interface RulesPagePayoutProps {
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

export function RulesPagePayout({ context, replayNonce }: RulesPagePayoutProps) {
  // Example calculations
  const examples = [
    { pot: 280, restants: 7, label: 'Beaucoup de restants' },
    { pot: 280, restants: 4, label: 'Équilibré' },
    { pot: 280, restants: 2, label: 'Peu de restants' },
  ];
  
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
          Répartition des jetons
        </h1>
        <p className="text-[#9CA3AF]">La cagnotte est distribuée uniquement au niveau 5 ou en cas de chavirement</p>
      </motion.div>

      {/* Formula */}
      <motion.div
        variants={itemVariants}
        className="bg-[#1a1f2e] rounded-xl p-6 border border-[#D4AF37]/20"
      >
        <div className="flex items-center gap-3 mb-4">
          <Calculator className="h-6 w-6 text-[#D4AF37]" />
          <h2 className="text-[#D4AF37] font-bold text-lg">Formule de calcul</h2>
        </div>
        
        <div className="bg-[#0B1020] rounded-lg p-4 text-center">
          <p className="text-2xl font-mono text-white">
            Gain = <span className="text-[#D4AF37]">floor</span>(Cagnotte ÷ Nb Restants)
          </p>
        </div>
        
        <p className="text-[#9CA3AF] text-sm mt-4">
          La fonction <code className="text-[#D4AF37]">floor</code> arrondit à l'entier inférieur. 
          Les jetons restants après la division sont perdus.
        </p>
      </motion.div>

      {/* Examples */}
      <motion.div variants={itemVariants}>
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Coins className="h-5 w-5 text-[#D4AF37]" />
          Exemples avec une cagnotte de 280 jetons
        </h2>
        
        <div className="space-y-3">
          {examples.map((ex, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="bg-[#1a1f2e] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex">
                  {Array.from({ length: Math.min(ex.restants, 5) }).map((_, j) => (
                    <div 
                      key={j}
                      className="w-6 h-6 -ml-1 first:ml-0 rounded-full bg-blue-500/30 border border-blue-500/50 flex items-center justify-center"
                    >
                      <Users className="h-3 w-3 text-blue-400" />
                    </div>
                  ))}
                  {ex.restants > 5 && (
                    <span className="ml-1 text-xs text-blue-400">+{ex.restants - 5}</span>
                  )}
                </div>
                <span className="text-[#9CA3AF] text-sm">{ex.label}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[#9CA3AF] text-sm">{ex.pot} ÷ {ex.restants} =</span>
                <span className="text-[#D4AF37] font-bold text-lg">
                  {computePayoutPerPlayer(ex.pot, ex.restants)}
                </span>
                <span className="text-[#9CA3AF] text-sm">/ joueur</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Key insight - When distribution happens */}
      <motion.div
        variants={itemVariants}
        className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5"
      >
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-amber-400 font-bold mb-2">Quand la cagnotte est distribuée ?</h3>
            <ul className="text-[#E8E8E8] text-sm space-y-2">
              <li>• <strong>Niveaux 1-4 réussis :</strong> La cagnotte s'accumule, pas de distribution</li>
              <li>• <strong>Niveau 5 réussi :</strong> Les restants partagent la cagnotte + bonus 100</li>
              <li>• <strong>Chavirement (n'importe quel niveau) :</strong> Les descendus de la manche partagent</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Level 5 bonus */}
      <motion.div
        variants={itemVariants}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#D4AF37]/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[#D4AF37] font-bold">5</span>
          </div>
          <div>
            <h3 className="text-[#D4AF37] font-bold mb-2">Bonus du niveau 5</h3>
            <p className="text-[#E8E8E8] text-sm">
              Au niveau 5 de chaque manche, les joueurs qui réussissent (restent et survivent) 
              reçoivent un <span className="text-[#D4AF37] font-bold">bonus de 100 jetons</span> en plus 
              de leur part de la cagnotte.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
