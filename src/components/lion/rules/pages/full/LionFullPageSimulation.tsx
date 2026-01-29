import { motion } from 'framer-motion';
import { Calculator, Lightbulb } from 'lucide-react';
import { LionSimulator } from '../../LionSimulator';

interface LionFullPageSimulationProps {
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

export function LionFullPageSimulation({ replayNonce }: LionFullPageSimulationProps) {
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
          Simulation Interactive
        </h1>
        <p className="text-amber-200/80">
          Expérimentez différents scénarios pour maîtriser le scoring
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
          <p className="text-blue-200/80 text-sm mt-1">
            Ajustez les paramètres (carte croupier, carte jouée, prédiction) pour voir 
            instantanément comment les points sont calculés. Cet outil est purement pédagogique 
            et ne modifie pas la partie en cours.
          </p>
        </div>
      </motion.div>

      {/* Simulator */}
      <motion.div variants={itemVariants}>
        <LionSimulator />
      </motion.div>

      {/* Tips */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-amber-300 font-bold">💡 Astuces de simulation</h3>
        
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
          <p className="text-amber-200/80 text-sm">
            <strong>Test extrême :</strong> Essayez Croupier = 0, Carte = 10 pour voir le gain maximum (d=10).
          </p>
        </div>
        
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
          <p className="text-amber-200/80 text-sm">
            <strong>Match nul :</strong> Essayez des valeurs identiques (ex: 5 et 5) pour voir le cas d=0.
          </p>
        </div>
        
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
          <p className="text-amber-200/80 text-sm">
            <strong>Stratégie défensive :</strong> Jouer une carte proche du croupier limite les gains adverses.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
