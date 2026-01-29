import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

interface LionFullPageTurnProps {
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

export function LionFullPageTurn({ replayNonce }: LionFullPageTurnProps) {
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
          <span className="text-amber-400 font-medium text-sm">Règles complètes</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Déroulé d'un tour
        </h1>
      </motion.div>

      {/* Example setup */}
      <motion.div 
        variants={itemVariants}
        className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4 text-center"
      >
        <p className="text-amber-300 text-sm">
          <strong>Exemple :</strong> Tour où A est actif et B devine
        </p>
      </motion.div>

      {/* Steps */}
      <motion.div variants={itemVariants} className="space-y-4">
        {/* Step 1 */}
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
              1
            </div>
            <h3 className="text-amber-300 font-bold">Révélation du Croupier</h3>
          </div>
          <p className="text-amber-200/80 text-sm">
            Le croupier tire une carte de <strong>Deck A</strong> (car A est l'actif) 
            et la révèle. Cette carte devient la <strong>référence</strong> pour ce tour.
          </p>
          <div className="mt-3 flex justify-center">
            <div className="w-14 h-20 bg-amber-700 border-2 border-amber-500 rounded-lg flex items-center justify-center text-2xl font-bold text-amber-100">
              5
            </div>
          </div>
          <p className="text-amber-400 text-xs text-center mt-2">Exemple : Croupier révèle un 5</p>
        </div>

        {/* Step 2 */}
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
              2
            </div>
            <h3 className="text-amber-300 font-bold">Choix du Joueur Actif (A)</h3>
          </div>
          <p className="text-amber-200/80 text-sm">
            A regarde sa main et choisit une carte. Il la pose <strong>face cachée</strong> 
            puis verrouille son choix. B ne voit pas quelle carte a été choisie.
          </p>
          <div className="mt-3 flex justify-center">
            <div className="w-14 h-20 bg-gray-800 border-2 border-amber-500 rounded-lg flex items-center justify-center text-2xl">
              🦁
            </div>
          </div>
          <p className="text-amber-400 text-xs text-center mt-2">Carte posée face cachée</p>
        </div>

        {/* Step 3 */}
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
              3
            </div>
            <h3 className="text-amber-300 font-bold">Prédiction du Devineur (B)</h3>
          </div>
          <p className="text-amber-200/80 text-sm">
            B doit prédire : la carte de A est-elle <strong className="text-green-400">PLUS HAUTE</strong> ou 
            <strong className="text-red-400"> PLUS BASSE</strong> que la carte du croupier ?
          </p>
          <div className="mt-3 flex justify-center gap-4">
            <div className="px-4 py-2 bg-green-800/50 border border-green-600 rounded-lg text-green-300 font-bold">
              ⬆️ PLUS HAUT
            </div>
            <div className="px-4 py-2 bg-red-800/50 border border-red-600 rounded-lg text-red-300 font-bold">
              ⬇️ PLUS BAS
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
              4
            </div>
            <h3 className="text-amber-300 font-bold">Révélation & Calcul</h3>
          </div>
          <p className="text-amber-200/80 text-sm">
            On retourne la carte de A. On calcule <strong>d = |Carte A − Carte Croupier|</strong> 
            et on attribue les points selon les règles de scoring.
          </p>
        </div>

        {/* Step 5 */}
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
              5
            </div>
            <h3 className="text-amber-300 font-bold">Défausse & Tour Suivant</h3>
          </div>
          <p className="text-amber-200/80 text-sm">
            La carte jouée par A et la carte du croupier sont défaussées (retirées du jeu). 
            Au tour suivant, les rôles s'inversent : B devient actif, A devient devineur.
          </p>
        </div>
      </motion.div>

      {/* Important note */}
      <motion.div 
        variants={itemVariants}
        className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4"
      >
        <p className="text-blue-300 text-sm">
          <strong>💡 Note :</strong> Les cartes sont défaussées définitivement. 
          À mesure que la partie avance, les options se réduisent tant pour les joueurs que pour le croupier.
        </p>
      </motion.div>
    </motion.div>
  );
}
