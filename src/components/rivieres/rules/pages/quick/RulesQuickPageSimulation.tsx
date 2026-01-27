import { motion } from 'framer-motion';
import { Calculator } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';
import { RivieresRulesSimulation } from '../../RivieresRulesSimulation';

interface RulesQuickPageSimulationProps {
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

export function RulesQuickPageSimulation({ context, replayNonce }: RulesQuickPageSimulationProps) {
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
          Testez différents scénarios sans affecter la partie réelle
        </p>
      </motion.div>

      {/* Simulation component */}
      <motion.div variants={itemVariants}>
        <RivieresRulesSimulation context={context} compact />
      </motion.div>
    </motion.div>
  );
}
