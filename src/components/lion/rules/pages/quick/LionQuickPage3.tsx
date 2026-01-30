import { motion } from 'framer-motion';
import { Calculator, Swords } from 'lucide-react';

interface LionQuickPage3Props {
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

export function LionQuickPage3({ replayNonce }: LionQuickPage3Props) {
  return (
    <motion.div
      key={replayNonce}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Title */}
      <motion.div variants={itemVariants} className="text-center">
        <div className="inline-flex items-center gap-2 bg-amber-600/20 border border-amber-500/30 rounded-full px-4 py-1.5 mb-3">
          <Calculator className="h-4 w-4 text-amber-400" />
          <span className="text-amber-400 font-medium text-sm">Scoring</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Calcul des points
        </h1>
      </motion.div>

      {/* Formula */}
      <motion.div 
        variants={itemVariants}
        className="bg-gradient-to-br from-amber-800/50 to-amber-900/50 border border-amber-600 rounded-xl p-4"
      >
        <h2 className="text-base font-bold text-amber-300 mb-2 text-center">
          d = |Carte Actif − Carte Croupier|
        </h2>
        <p className="text-amber-200/80 text-center text-sm">
          La différence absolue entre les deux cartes détermine les points en jeu
        </p>
      </motion.div>

      {/* Guesser Wins Cases */}
      <motion.div variants={itemVariants} className="space-y-2">
        <h3 className="text-green-400 font-bold text-sm">✅ Le Devineur gagne si :</h3>
        
        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-green-800/50 flex items-center justify-center text-lg flex-shrink-0">
              🎯
            </div>
            <div>
              <p className="text-green-200/80 text-sm">
                <strong className="text-green-300">ÉGAL</strong> et cartes identiques → <span className="text-green-400 font-bold">+10 PVic</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-green-800/50 flex items-center justify-center text-lg flex-shrink-0">
              ⬆️
            </div>
            <div>
              <p className="text-green-200/80 text-sm">
                <strong className="text-green-300">PLUS HAUT</strong> et carte actif {'>'} croupier → <span className="text-green-400 font-bold">+d PVic</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-green-800/50 flex items-center justify-center text-lg flex-shrink-0">
              ⬇️
            </div>
            <div>
              <p className="text-green-200/80 text-sm">
                <strong className="text-green-300">PLUS BAS</strong> et carte actif {'<'} croupier → <span className="text-green-400 font-bold">+d PVic</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Active Player Wins Cases */}
      <motion.div variants={itemVariants} className="space-y-2">
        <h3 className="text-amber-400 font-bold text-sm">❌ L'Actif gagne si le devineur se trompe :</h3>
        
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-amber-800/50 flex items-center justify-center text-lg flex-shrink-0">
              🎯
            </div>
            <div>
              <p className="text-amber-200/80 text-sm">
                Cartes identiques mais pas <strong className="text-amber-300">ÉGAL</strong> → <span className="text-amber-400 font-bold">+2 PVic</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded bg-amber-800/50 flex items-center justify-center text-lg flex-shrink-0">
              ❓
            </div>
            <div>
              <p className="text-amber-200/80 text-sm">
                Mauvaise prédiction (plus haut/bas) → <span className="text-amber-400 font-bold">+d PVic</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sudden Death */}
      <motion.div 
        variants={itemVariants}
        className="bg-red-900/20 border border-red-600/50 rounded-lg p-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <Swords className="h-4 w-4 text-red-400" />
          <h3 className="text-red-300 font-bold text-sm">Mort Subite</h3>
        </div>
        <p className="text-red-200/80 text-sm">
          En cas d'<strong>égalité après 22 tours</strong>, on joue des duos de tours (A+B) 
          jusqu'à ce qu'un joueur l'emporte sur un duo complet.
        </p>
      </motion.div>
    </motion.div>
  );
}
