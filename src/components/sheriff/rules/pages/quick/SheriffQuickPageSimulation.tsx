import { motion } from 'framer-motion';
import { Calculator, Lightbulb } from 'lucide-react';
import { SheriffRulesContextData } from '../../useSheriffRulesContext';
import { SheriffSimulationSection } from '../../SheriffSimulationSection';

interface SheriffQuickPageSimulationProps {
  context: SheriffRulesContextData;
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

export function SheriffQuickPageSimulation({ context, replayNonce }: SheriffQuickPageSimulationProps) {
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
        <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-4 py-1.5 mb-3">
          <Calculator className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-[#D4AF37] font-medium text-sm">Outil pédagogique</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Simulation
        </h1>
        <p className="text-[#9CA3AF]">
          Expérimentez les différents scénarios
        </p>
      </motion.div>

      {/* Info box */}
      <motion.div
        variants={itemVariants}
        className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3"
      >
        <Lightbulb className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-400 font-medium text-sm">À quoi sert cette simulation ?</p>
          <p className="text-[#E8E8E8] text-sm mt-1">
            Testez les différentes combinaisons de visa, jetons et duels pour comprendre 
            comment les Points de Victoire évoluent. Cet outil est purement pédagogique.
          </p>
        </div>
      </motion.div>

      {/* Simulation component */}
      <motion.div variants={itemVariants}>
        <SheriffSimulationSection context={context} />
      </motion.div>
    </motion.div>
  );
}
