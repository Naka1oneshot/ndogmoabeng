import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';

interface LionFullPageSuddenDeathProps {
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

export function LionFullPageSuddenDeath({ replayNonce }: LionFullPageSuddenDeathProps) {
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
        <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-full px-4 py-1.5 mb-3">
          <Swords className="h-4 w-4 text-red-400" />
          <span className="text-red-400 font-medium text-sm">Règles complètes</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Mort Subite
        </h1>
        <p className="text-red-200/80">
          Règle d'égalité après 22 tours
        </p>
      </motion.div>

      {/* When */}
      <motion.div 
        variants={itemVariants}
        className="bg-red-900/20 border border-red-600/50 rounded-xl p-5"
      >
        <h2 className="text-lg font-bold text-red-300 mb-3 flex items-center gap-2">
          <span className="text-2xl">⚠️</span> Quand ?
        </h2>
        <p className="text-red-100 leading-relaxed">
          Si après les <strong>22 tours</strong> de la partie normale, 
          les deux joueurs ont le <strong>même nombre de PVic</strong>, 
          on entre en <strong className="text-red-300">Mort Subite</strong>.
        </p>
      </motion.div>

      {/* How */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-bold text-amber-300 mb-4">🔄 Comment ça marche ?</h2>
        
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">
                1
              </div>
              <h3 className="text-amber-300 font-bold">Reset complet</h3>
            </div>
            <p className="text-amber-200/80 text-sm">
              On réinitialise les <strong>mains</strong> des deux joueurs (cartes 0-10 de nouveau disponibles) 
              et les <strong>decks du croupier</strong>. Les PVic accumulés sont conservés.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">
                2
              </div>
              <h3 className="text-amber-300 font-bold">Duo de tours</h3>
            </div>
            <p className="text-amber-200/80 text-sm">
              On joue un <strong>duo de tours</strong> : d'abord A est actif (B devine), 
              puis B est actif (A devine). C'est un mini-duel de 2 tours.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2 text-sm">
              <div className="bg-amber-800/50 px-3 py-1 rounded text-amber-300">Tour 1: A joue</div>
              <span className="text-amber-500">→</span>
              <div className="bg-amber-800/50 px-3 py-1 rounded text-amber-300">Tour 2: B joue</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">
                3
              </div>
              <h3 className="text-amber-300 font-bold">Détermination du gagnant</h3>
            </div>
            <p className="text-amber-200/80 text-sm">
              On compare les points <strong>gagnés sur ce duo uniquement</strong> 
              (pas le score total). Celui qui a marqué le plus sur ces 2 tours gagne la partie.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">
                4
              </div>
              <h3 className="text-amber-300 font-bold">Encore égalité ?</h3>
            </div>
            <p className="text-amber-200/80 text-sm">
              Si le duo se termine aussi par une égalité, on recommence : 
              nouveau reset, nouveau duo. Et ainsi de suite jusqu'à ce qu'un joueur l'emporte.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Example */}
      <motion.div 
        variants={itemVariants}
        className="bg-amber-950/50 border border-amber-800 rounded-lg p-4"
      >
        <h3 className="text-amber-400 font-medium mb-3">📝 Exemple de Mort Subite</h3>
        <div className="space-y-2 text-amber-200/80 text-sm">
          <p>Score après 22 tours : <strong>A = 45</strong>, <strong>B = 45</strong> → Égalité !</p>
          <p className="text-red-400">⚔️ Mort Subite déclenchée</p>
          <p>Duo #1 :</p>
          <ul className="ml-4 space-y-1">
            <li>• Tour 1 (A actif) : B devine juste → B +6</li>
            <li>• Tour 2 (B actif) : A devine faux → B +4</li>
          </ul>
          <p>Points du duo : A = 0, B = 10</p>
          <p className="text-green-400 font-bold">🏆 B remporte la Mort Subite !</p>
        </div>
      </motion.div>

      {/* Note */}
      <motion.div 
        variants={itemVariants}
        className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4"
      >
        <p className="text-blue-300 text-sm">
          <strong>💡 Note :</strong> La Mort Subite peut théoriquement durer plusieurs duos, 
          mais statistiquement une égalité parfaite sur 2 tours est rare.
        </p>
      </motion.div>
    </motion.div>
  );
}
