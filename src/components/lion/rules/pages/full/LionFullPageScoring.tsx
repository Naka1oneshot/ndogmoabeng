import { motion } from 'framer-motion';
import { Calculator } from 'lucide-react';

interface LionFullPageScoringProps {
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

export function LionFullPageScoring({ replayNonce }: LionFullPageScoringProps) {
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
          <span className="text-amber-400 font-medium text-sm">Règles complètes</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Calcul des points
        </h1>
      </motion.div>

      {/* Formula */}
      <motion.div 
        variants={itemVariants}
        className="bg-gradient-to-br from-amber-800/50 to-amber-900/50 border-2 border-amber-600 rounded-xl p-6 text-center"
      >
        <h2 className="text-2xl font-bold text-amber-300 mb-2">
          d = | Carte Actif − Carte Croupier |
        </h2>
        <p className="text-amber-200/80">
          La valeur absolue de la différence entre les deux cartes
        </p>
      </motion.div>

      {/* Cases */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-lg font-bold text-amber-300">Attribution des points</h3>

        {/* Case d=0 */}
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-gray-700 flex items-center justify-center">
              <span className="text-3xl">🤷</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-300">Si d = 0</h4>
              <p className="text-gray-400">Les deux cartes sont identiques</p>
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 text-center">
            <p className="text-gray-300 font-medium">
              <strong>0 point</strong> pour tout le monde
            </p>
          </div>
        </div>

        {/* Case correct */}
        <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-green-800/50 flex items-center justify-center">
              <span className="text-3xl">✅</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-green-300">Devineur correct</h4>
              <p className="text-green-400/80">Le devineur a bien prédit la direction</p>
            </div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-3 text-center">
            <p className="text-green-300 font-medium text-lg">
              Le devineur gagne <strong className="text-green-200">2 × d</strong> PVic
            </p>
          </div>
        </div>

        {/* Case incorrect */}
        <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 rounded-xl bg-amber-800/50 flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-amber-300">Devineur incorrect</h4>
              <p className="text-amber-400/80">Le devineur s'est trompé</p>
            </div>
          </div>
          <div className="bg-amber-900/30 rounded-lg p-3 text-center">
            <p className="text-amber-300 font-medium text-lg">
              Le joueur actif gagne <strong className="text-amber-200">d</strong> PVic
            </p>
          </div>
        </div>
      </motion.div>

      {/* Examples */}
      <motion.div variants={itemVariants}>
        <h3 className="text-lg font-bold text-amber-300 mb-4">📝 Exemples détaillés</h3>
        
        <div className="space-y-3">
          {/* Example 1 */}
          <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex gap-2">
                <div className="w-10 h-14 bg-amber-700 rounded flex items-center justify-center font-bold text-amber-100">3</div>
                <span className="text-amber-500 self-center">vs</span>
                <div className="w-10 h-14 bg-amber-700 rounded flex items-center justify-center font-bold text-amber-100">9</div>
              </div>
            </div>
            <p className="text-amber-200/80 text-sm">
              Croupier = 3, Actif joue = 9 → d = |9-3| = <strong>6</strong>
            </p>
            <p className="text-amber-200/80 text-sm">
              Devineur dit "PLUS HAUT" → <span className="text-green-400">Correct ! +12 PVic pour le devineur</span>
            </p>
          </div>

          {/* Example 2 */}
          <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex gap-2">
                <div className="w-10 h-14 bg-amber-700 rounded flex items-center justify-center font-bold text-amber-100">7</div>
                <span className="text-amber-500 self-center">vs</span>
                <div className="w-10 h-14 bg-amber-700 rounded flex items-center justify-center font-bold text-amber-100">2</div>
              </div>
            </div>
            <p className="text-amber-200/80 text-sm">
              Croupier = 7, Actif joue = 2 → d = |2-7| = <strong>5</strong>
            </p>
            <p className="text-amber-200/80 text-sm">
              Devineur dit "PLUS HAUT" → <span className="text-amber-400">Incorrect ! +5 PVic pour l'actif</span>
            </p>
          </div>

          {/* Example 3 */}
          <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex gap-2">
                <div className="w-10 h-14 bg-amber-700 rounded flex items-center justify-center font-bold text-amber-100">4</div>
                <span className="text-amber-500 self-center">vs</span>
                <div className="w-10 h-14 bg-amber-700 rounded flex items-center justify-center font-bold text-amber-100">4</div>
              </div>
            </div>
            <p className="text-amber-200/80 text-sm">
              Croupier = 4, Actif joue = 4 → d = |4-4| = <strong>0</strong>
            </p>
            <p className="text-amber-200/80 text-sm">
              <span className="text-gray-400">Aucun point pour personne, peu importe le choix</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Strategy note */}
      <motion.div 
        variants={itemVariants}
        className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4"
      >
        <p className="text-blue-300 text-sm">
          <strong>💡 Stratégie :</strong> Le joueur actif a intérêt à maximiser d s'il pense que le devineur 
          se trompera, ou à minimiser d (voire jouer la même valeur) s'il pense que le devineur devinera juste.
        </p>
      </motion.div>
    </motion.div>
  );
}
