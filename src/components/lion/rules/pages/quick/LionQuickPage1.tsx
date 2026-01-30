import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Users, Clock, Loader2 } from 'lucide-react';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface LionQuickPage1Props {
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

export function LionQuickPage1({ replayNonce }: LionQuickPage1Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('LION');
  const section = getSection('quick_objectif');
  const paragraphs = getParagraphs('quick_objectif');

  const dynamicContent = useMemo(() => {
    const title = section?.title || 'Lire dans le cœur de l\'autre';
    const subtitle = paragraphs.find(p => p.id === 'lq1_subtitle')?.text 
      || 'Un duel mental où tu dois deviner la stratégie de ton adversaire';
    const goal = paragraphs.find(p => p.id === 'lq1_goal')?.text 
      || 'Accumule le plus de <strong class="text-amber-300">Points de Victoire (PVic)</strong> en 22 tours. Chaque tour, un joueur pose une carte face cachée, l\'autre doit deviner si elle est <strong class="text-green-400">plus haute</strong> ou <strong class="text-red-400">plus basse</strong> que la carte du croupier.';
    const activeDesc = paragraphs.find(p => p.id === 'lq1_active')?.text 
      || 'Pose une carte de sa main face cachée. Cherche à tromper le devineur.';
    const guesserDesc = paragraphs.find(p => p.id === 'lq1_guesser')?.text 
      || 'Annonce "Plus haut" ou "Plus bas" par rapport à la carte croupier.';
    const material = paragraphs.find(p => p.id === 'lq1_material')?.items 
      || ['Chaque joueur a une <strong>main de 11 cartes</strong> (0 à 10)', 'Le croupier possède <strong>2 decks</strong> (un par joueur actif)', 'Les cartes jouées sont <strong>défaussées définitivement</strong>'];
    
    return { title, subtitle, goal, activeDesc, guesserDesc, material };
  }, [section, paragraphs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

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
          {dynamicContent.title}
        </h1>
        <p className="text-amber-200/80" dangerouslySetInnerHTML={{ __html: dynamicContent.subtitle }} />
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

      {/* Goal */}
      <motion.div 
        variants={itemVariants}
        className="bg-gradient-to-br from-amber-800/40 to-amber-900/40 border border-amber-600 rounded-xl p-5"
      >
        <h2 className="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
          <span className="text-2xl">🏆</span> But du jeu
        </h2>
        <p className="text-amber-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: dynamicContent.goal }} />
      </motion.div>

      {/* Roles */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
          <div className="text-2xl mb-2">🎴</div>
          <h3 className="text-amber-300 font-bold mb-1">Joueur Actif</h3>
          <p className="text-amber-200/80 text-sm" dangerouslySetInnerHTML={{ __html: dynamicContent.activeDesc }} />
        </div>
        <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
          <div className="text-2xl mb-2">🔮</div>
          <h3 className="text-amber-300 font-bold mb-1">Devineur</h3>
          <p className="text-amber-200/80 text-sm" dangerouslySetInnerHTML={{ __html: dynamicContent.guesserDesc }} />
        </div>
      </motion.div>

      {/* Material */}
      <motion.div variants={itemVariants} className="bg-amber-950/50 border border-amber-800 rounded-lg p-4">
        <h3 className="text-amber-400 font-medium mb-2">📦 Matériel</h3>
        <ul className="space-y-1 text-amber-200/80 text-sm">
          {dynamicContent.material.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}
