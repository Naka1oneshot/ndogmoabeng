import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Swords, Loader2 } from 'lucide-react';
import { useDynamicRules } from '@/hooks/useDynamicRules';

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

const DEFAULT_STEPS = [
  {
    num: 1,
    title: 'Reset complet',
    desc: 'On réinitialise les <strong>mains</strong> des deux joueurs (cartes 0-10 de nouveau disponibles) et les <strong>decks du croupier</strong>. Les PVic accumulés sont conservés.',
  },
  {
    num: 2,
    title: 'Duo de tours',
    desc: 'On joue un <strong>duo de tours</strong> : d\'abord A est actif (B devine), puis B est actif (A devine). C\'est un mini-duel de 2 tours.',
  },
  {
    num: 3,
    title: 'Détermination du gagnant',
    desc: 'On compare les points <strong>gagnés sur ce duo uniquement</strong> (pas le score total). Celui qui a marqué le plus sur ces 2 tours gagne la partie.',
  },
  {
    num: 4,
    title: 'Encore égalité ?',
    desc: 'Si le duo se termine aussi par une égalité, on recommence : nouveau reset, nouveau duo. Et ainsi de suite jusqu\'à ce qu\'un joueur l\'emporte.',
  },
];

export function LionFullPageSuddenDeath({ replayNonce }: LionFullPageSuddenDeathProps) {
  const { getSection, getParagraphs, loading } = useDynamicRules('LION');
  const section = getSection('full_sudden_death');
  const paragraphs = getParagraphs('full_sudden_death');

  const dynamicContent = useMemo(() => {
    const when = paragraphs.find(p => p.id === 'lf4_when')?.text 
      || 'Si après les <strong>22 tours</strong> de la partie normale, les deux joueurs ont le <strong>même nombre de PVic</strong>, on entre en <strong class="text-red-300">Mort Subite</strong>.';
    const note = paragraphs.find(p => p.id === 'lf4_note')?.text 
      || 'La Mort Subite peut théoriquement durer plusieurs duos, mais statistiquement une égalité parfaite sur 2 tours est rare.';
    
    return { when, note };
  }, [paragraphs]);

  const steps = useMemo(() => {
    return DEFAULT_STEPS.map((step, i) => {
      const dynamicStep = paragraphs.find(p => p.id === `lf4_step${i + 1}`);
      return {
        ...step,
        title: dynamicStep?.text?.match(/<strong>([^<]+)<\/strong>/)?.[1] || step.title,
        desc: dynamicStep?.text || step.desc,
      };
    });
  }, [paragraphs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-red-400" />
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
        <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-full px-4 py-1.5 mb-3">
          <Swords className="h-4 w-4 text-red-400" />
          <span className="text-red-400 font-medium text-sm">Règles complètes</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {section?.title || 'Mort Subite'}
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
        <p className="text-red-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: dynamicContent.when }} />
      </motion.div>

      {/* How */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-bold text-amber-300 mb-4">🔄 Comment ça marche ?</h2>
        
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.num} className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">
                  {step.num}
                </div>
                <h3 className="text-amber-300 font-bold">{step.title}</h3>
              </div>
              <p className="text-amber-200/80 text-sm" dangerouslySetInnerHTML={{ __html: step.desc }} />
              
              {step.num === 2 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                  <div className="bg-amber-800/50 px-3 py-1 rounded text-amber-300">Tour 1: A joue</div>
                  <span className="text-amber-500">→</span>
                  <div className="bg-amber-800/50 px-3 py-1 rounded text-amber-300">Tour 2: B joue</div>
                </div>
              )}
            </div>
          ))}
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
          <strong>💡 Note :</strong> <span dangerouslySetInnerHTML={{ __html: dynamicContent.note }} />
        </p>
      </motion.div>
    </motion.div>
  );
}
