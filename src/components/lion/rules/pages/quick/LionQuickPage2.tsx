import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Loader2 } from 'lucide-react';
import { useDynamicRules } from '@/hooks/useDynamicRules';

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

const DEFAULT_STEPS = [
  { num: 1, title: 'Révélation Croupier', desc: 'Le croupier tire et révèle une carte de son deck (celui associé au joueur actif).' },
  { num: 2, title: "Choix de l'Actif", desc: 'Le joueur actif choisit une carte de sa main et la pose <strong class="text-amber-300">face cachée</strong>.' },
  { num: 3, title: 'Prédiction du Devineur', desc: 'Le devineur annonce : la carte cachée sera <span class="text-green-400 font-bold">PLUS HAUTE</span> ou <span class="text-red-400 font-bold">PLUS BASSE</span> que le croupier ?' },
  { num: 4, title: 'Révélation & Scoring', desc: 'On révèle la carte. On calcule la différence et on attribue les points.' },
  { num: 5, title: 'Défausse & Alternance', desc: 'Les deux cartes (jouée + croupier) sont défaussées. Les rôles s\'inversent pour le tour suivant.' },
];

export function LionQuickPage2({ replayNonce }: LionQuickPage2Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('LION');
  const section = getSection('quick_deroulement');
  const paragraphs = getParagraphs('quick_deroulement');

  const steps = useMemo(() => {
    return DEFAULT_STEPS.map((step, i) => {
      const dynamicStep = paragraphs.find(p => p.id === `lq2_step${i + 1}`);
      return {
        ...step,
        title: dynamicStep?.text?.match(/<strong>([^<]+)<\/strong>/)?.[1] || step.title,
        desc: dynamicStep?.text || step.desc,
      };
    });
  }, [paragraphs]);

  const alternance = useMemo(() => {
    return paragraphs.find(p => p.id === 'lq2_alternance')?.text 
      || '<strong>Alternance stricte :</strong> A joue → B devine → B joue → A devine → ...<br />22 tours au total (11 où tu es actif, 11 où tu devines)';
  }, [paragraphs]);

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
          <RotateCcw className="h-4 w-4 text-amber-400" />
          <span className="text-amber-400 font-medium text-sm">Déroulé</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {section?.title || 'Comment se déroule un tour ?'}
        </h1>
      </motion.div>

      {/* Steps */}
      <motion.div variants={itemVariants} className="space-y-4">
        {steps.map((step) => (
          <div key={step.num} className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold shrink-0">
              {step.num}
            </div>
            <div className="flex-1 bg-amber-900/40 border border-amber-700 rounded-lg p-4">
              <h3 className="text-amber-300 font-bold mb-1">{step.title}</h3>
              <p className="text-amber-200/80 text-sm" dangerouslySetInnerHTML={{ __html: step.desc }} />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Alternance */}
      <motion.div 
        variants={itemVariants}
        className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-4"
      >
        <p className="text-blue-300 text-sm text-center" dangerouslySetInnerHTML={{ __html: alternance }} />
      </motion.div>
    </motion.div>
  );
}
