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
      className="space-y-6"
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
        className="bg-gradient-to-br from-amber-800/50 to-amber-900/50 border border-amber-600 rounded-xl p-5"
      >
        <h2 className="text-lg font-bold text-amber-300 mb-3 text-center">
          d = |Carte Actif − Carte Croupier|
        </h2>
        <p className="text-amber-200/80 text-center text-sm">
          La différence absolue entre les deux cartes détermine les points en jeu
        </p>
      </motion.div>

      {/* Cases */}
      <motion.div variants={itemVariants} className="space-y-3">
        {/* Case d=0 */}
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center text-2xl">
              😐
            </div>
            <div>
              <h3 className="text-gray-300 font-bold">Si d = 0</h3>
              <p className="text-gray-400 text-sm">Aucun point pour personne</p>
            </div>
          </div>
        </div>

        {/* Case correct */}
        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-800/50 flex items-center justify-center text-2xl">
              ✅
            </div>
            <div>
              <h3 className="text-green-300 font-bold">Devineur correct</h3>
              <p className="text-green-200/80 text-sm">
                Le devineur gagne <strong className="text-green-300">2 × d</strong> points
              </p>
            </div>
          </div>
        </div>

        {/* Case incorrect */}
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-amber-800/50 flex items-center justify-center text-2xl">
              ❌
            </div>
            <div>
              <h3 className="text-amber-300 font-bold">Devineur incorrect</h3>
              <p className="text-amber-200/80 text-sm">
                L'actif gagne <strong className="text-amber-300">d</strong> points
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Example */}
      <motion.div 
        variants={itemVariants}
        className="bg-amber-950/50 border border-amber-800 rounded-lg p-4"
      >
        <h3 className="text-amber-400 font-medium mb-2">📝 Exemple</h3>
        <p className="text-amber-200/80 text-sm mb-2">
          Croupier = <strong>3</strong>, Carte Actif = <strong>8</strong>
        </p>
        <p className="text-amber-200/80 text-sm">
          → d = |8 − 3| = <strong>5</strong>
        </p>
        <p className="text-amber-200/80 text-sm">
          → Si le devineur dit "PLUS HAUT" (correct) : <span className="text-green-400">+10 PVic</span>
        </p>
        <p className="text-amber-200/80 text-sm">
          → Si le devineur dit "PLUS BAS" (incorrect) : Actif <span className="text-amber-400">+5 PVic</span>
        </p>
      </motion.div>

      {/* Sudden Death */}
      <motion.div 
        variants={itemVariants}
        className="bg-red-900/20 border border-red-600/50 rounded-lg p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <Swords className="h-5 w-5 text-red-400" />
          <h3 className="text-red-300 font-bold">Mort Subite</h3>
        </div>
        <p className="text-red-200/80 text-sm">
          En cas d'<strong>égalité après 22 tours</strong>, on joue des duos de tours (A+B) 
          jusqu'à ce qu'un joueur l'emporte sur un duo complet.
        </p>
      </motion.div>
    </motion.div>
  );
}
