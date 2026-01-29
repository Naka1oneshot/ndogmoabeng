import { motion } from 'framer-motion';
import { Calculator } from 'lucide-react';
import { LionSimulator } from '../../LionSimulator';

interface LionQuickPageSimulationProps {
  replayNonce: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function LionQuickPageSimulation({ replayNonce }: LionQuickPageSimulationProps) {
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
        <div className="inline-flex items-center gap-2 bg-amber-600/20 border border-amber-500/30 rounded-full px-4 py-1.5 mb-3">
          <Calculator className="h-4 w-4 text-amber-400" />
          <span className="text-amber-400 font-medium text-sm">Outil pédagogique</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Simulation
        </h1>
        <p className="text-amber-200/80">
          Testez différents scénarios pour comprendre le scoring
        </p>
      </motion.div>

      {/* Simulator */}
      <motion.div variants={itemVariants}>
        <LionSimulator />
      </motion.div>
    </motion.div>
  );
}
