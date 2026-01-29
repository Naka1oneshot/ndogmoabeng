import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

interface LionFullPageObjectiveProps {
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

export function LionFullPageObjective({ replayNonce }: LionFullPageObjectiveProps) {
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
          <Target className="h-4 w-4 text-amber-400" />
          <span className="text-amber-400 font-medium text-sm">Règles complètes</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Objectif & Matériel
        </h1>
      </motion.div>

      {/* Objective */}
      <motion.div 
        variants={itemVariants}
        className="bg-gradient-to-br from-amber-800/40 to-amber-900/40 border border-amber-600 rounded-xl p-5"
      >
        <h2 className="text-lg font-bold text-amber-300 mb-3">🎯 Objectif</h2>
        <p className="text-amber-100 leading-relaxed">
          <strong>Le CŒUR du Lion</strong> est un duel mental entre deux joueurs. 
          L'objectif est d'accumuler le maximum de <strong className="text-amber-300">Points de Victoire (PVic)</strong> 
          sur 22 tours en jouant stratégiquement ses cartes et en lisant les intentions de son adversaire.
        </p>
      </motion.div>

      {/* Material */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-bold text-amber-300 mb-4">📦 Matériel virtuel</h2>
        
        <div className="space-y-4">
          {/* Players */}
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-2">👥 Les joueurs</h3>
            <p className="text-amber-200/80 text-sm">
              2 joueurs désignés comme <strong>Joueur A</strong> et <strong>Joueur B</strong>. 
              Ils alternent les rôles de "Joueur Actif" (qui pose une carte) et de "Devineur" (qui prédit).
            </p>
          </div>

          {/* Hands */}
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-2">🎴 Les mains</h3>
            <p className="text-amber-200/80 text-sm mb-2">
              Chaque joueur possède une main de <strong>11 cartes</strong> numérotées de 0 à 10.
            </p>
            <div className="flex flex-wrap gap-1 justify-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <div 
                  key={n} 
                  className="w-8 h-10 bg-amber-700 border border-amber-500 rounded flex items-center justify-center text-sm font-bold text-amber-100"
                >
                  {n}
                </div>
              ))}
            </div>
            <p className="text-amber-400 text-xs mt-2 text-center">
              Une fois jouée, la carte est <strong>défaussée définitivement</strong>.
            </p>
          </div>

          {/* Decks */}
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
            <h3 className="text-amber-300 font-bold mb-2">🃏 Les decks du croupier</h3>
            <p className="text-amber-200/80 text-sm">
              Le croupier possède <strong>2 decks distincts</strong> :
            </p>
            <ul className="text-amber-200/80 text-sm mt-2 space-y-1">
              <li>• <strong>Deck A</strong> : utilisé uniquement quand A est le joueur actif</li>
              <li>• <strong>Deck B</strong> : utilisé uniquement quand B est le joueur actif</li>
            </ul>
            <p className="text-amber-400 text-xs mt-2">
              Chaque deck contient aussi les cartes 0-10. Tirage sans remise.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Game structure */}
      <motion.div 
        variants={itemVariants}
        className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-4"
      >
        <h3 className="text-blue-300 font-bold mb-2">⏱️ Structure de la partie</h3>
        <ul className="text-blue-200/80 text-sm space-y-1">
          <li>• <strong>22 tours au total</strong> : 11 où A joue, 11 où B joue</li>
          <li>• <strong>Alternance stricte</strong> : A → B → A → B → ...</li>
          <li>• <strong>Durée estimée</strong> : ~20 minutes</li>
        </ul>
      </motion.div>

      {/* Clans note */}
      <motion.div 
        variants={itemVariants}
        className="bg-gray-800/40 border border-gray-600/50 rounded-lg p-4"
      >
        <h3 className="text-gray-300 font-bold mb-2">🏛️ Clans</h3>
        <p className="text-gray-400 text-sm">
          <strong>Aucun bonus de clan</strong> n'est actif dans Le CŒUR du Lion. 
          Les joueurs peuvent avoir un clan associé à leur profil, mais il n'influence pas cette partie.
        </p>
      </motion.div>
    </motion.div>
  );
}
