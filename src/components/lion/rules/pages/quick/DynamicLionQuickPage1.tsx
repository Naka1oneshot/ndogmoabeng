import { motion } from 'framer-motion';
import { Target, Users, Clock } from 'lucide-react';
import { useDynamicRules } from '@/hooks/useDynamicRules';
import { DynamicSection } from '@/components/rules/DynamicSection';

interface DynamicLionQuickPage1Props {
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

export function DynamicLionQuickPage1({ replayNonce }: DynamicLionQuickPage1Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('LION');
  const section = getSection('quick_objectif');

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
          <span className="text-amber-400 font-medium text-sm">Objectif</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {section?.title || 'Lire dans le cœur de l\'autre'}
        </h1>
        <p className="text-amber-200/80">
          Un duel mental où tu dois deviner la stratégie de ton adversaire
        </p>
      </motion.div>

      {/* Quick Info */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4 text-center">
          <Users className="h-6 w-6 text-amber-400 mx-auto mb-2" />
          <p className="text-amber-300 font-bold text-lg">2 joueurs</p>
          <p className="text-amber-500 text-sm">Duel en face à face</p>
        </div>
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4 text-center">
          <Clock className="h-6 w-6 text-amber-400 mx-auto mb-2" />
          <p className="text-amber-300 font-bold text-lg">~20 min</p>
          <p className="text-amber-500 text-sm">22 tours de jeu</p>
        </div>
      </motion.div>

      {/* Dynamic Content */}
      {!loading && section && (
        <motion.div 
          variants={itemVariants}
          className="bg-gradient-to-br from-amber-800/40 to-amber-900/40 border border-amber-600 rounded-xl p-5"
        >
          <h2 className="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
            <span className="text-2xl">🏆</span> But du jeu
          </h2>
          <DynamicSection 
            paragraphs={getParagraphs('quick_objectif')} 
            textClassName="text-amber-100 leading-relaxed"
            listClassName="text-amber-200/80"
          />
        </motion.div>
      )}

      {/* Roles */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
          <div className="text-2xl mb-2">🎴</div>
          <h3 className="text-amber-300 font-bold mb-1">Joueur Actif</h3>
          <p className="text-amber-200/80 text-sm">
            Pose une carte de sa main face cachée. Cherche à tromper le devineur.
          </p>
        </div>
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
          <div className="text-2xl mb-2">🔮</div>
          <h3 className="text-amber-300 font-bold mb-1">Devineur</h3>
          <p className="text-amber-200/80 text-sm">
            Annonce "Plus haut" ou "Plus bas" par rapport à la carte croupier.
          </p>
        </div>
      </motion.div>

      {/* Material */}
      <motion.div variants={itemVariants} className="bg-amber-950/50 border border-amber-800 rounded-lg p-4">
        <h3 className="text-amber-400 font-medium mb-2">📦 Matériel</h3>
        <ul className="space-y-1 text-amber-200/80 text-sm">
          <li>• Chaque joueur a une <strong>main de 11 cartes</strong> (0 à 10)</li>
          <li>• Le croupier possède <strong>2 decks</strong> (un par joueur actif)</li>
          <li>• Les cartes jouées sont <strong>défaussées définitivement</strong></li>
        </ul>
      </motion.div>
    </motion.div>
  );
}
