import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

interface LionQuickPage2Props {
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

export function LionQuickPage2({ replayNonce }: LionQuickPage2Props) {
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
          <RotateCcw className="h-4 w-4 text-amber-400" />
          <span className="text-amber-400 font-medium text-sm">Déroulé</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Comment se déroule un tour ?
        </h1>
      </motion.div>

      {/* Steps */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
            1
          </div>
          <div className="flex-1 bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-1">Révélation Croupier</h3>
            <p className="text-amber-200/80 text-sm">
              Le croupier tire et révèle une carte de son deck (celui associé au joueur actif).
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
            2
          </div>
          <div className="flex-1 bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-1">Choix de l'Actif</h3>
            <p className="text-amber-200/80 text-sm">
              Le joueur actif choisit une carte de sa main et la pose <strong className="text-amber-300">face cachée</strong>.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
            3
          </div>
          <div className="flex-1 bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-1">Prédiction du Devineur</h3>
            <p className="text-amber-200/80 text-sm">
              Le devineur annonce : la carte cachée sera
              <span className="text-green-400 font-bold"> PLUS HAUTE</span> ou 
              <span className="text-red-400 font-bold"> PLUS BASSE</span> que le croupier ?
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
            4
          </div>
          <div className="flex-1 bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-1">Révélation & Scoring</h3>
            <p className="text-amber-200/80 text-sm">
              On révèle la carte. On calcule la différence et on attribue les points.
            </p>
          </div>
        </div>

        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
            5
          </div>
          <div className="flex-1 bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-1">Défausse & Alternance</h3>
            <p className="text-amber-200/80 text-sm">
              Les deux cartes (jouée + croupier) sont défaussées. Les rôles s'inversent pour le tour suivant.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Alternance */}
      <motion.div 
        variants={itemVariants}
        className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-4"
      >
        <p className="text-blue-300 text-sm text-center">
          <strong>Alternance stricte :</strong> A joue → B devine → B joue → A devine → ...
          <br />
          22 tours au total (11 où tu es actif, 11 où tu devines)
        </p>
      </motion.div>
    </motion.div>
  );
}
