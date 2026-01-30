import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowRight, Clock, Repeat, Loader2 } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface RulesPageCycleProps {
  context: RivieresRulesContextData;
  replayNonce: number;
  onNavigate?: (index: number) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Default steps - can be overridden by dynamic content
const DEFAULT_STEPS = [
  { num: 1, title: 'Décision', desc: 'Choisissez de RESTER sur le bateau ou de DESCENDRE à terre', color: 'blue' },
  { num: 2, title: 'Mise', desc: 'Si vous restez, misez des jetons qui rejoindront la cagnotte', color: 'amber' },
  { num: 3, title: 'Verrouillage', desc: 'Le MJ verrouille les décisions et révèle le danger', color: 'purple' },
  { num: 4, title: 'Confrontation', desc: 'Comparaison entre les mises totales et le danger', color: 'red' },
  { num: 5, title: 'Résolution', desc: 'Succès ou chavirement, distribution des jetons', color: 'green' },
];

export function RulesPageCycle({ context, replayNonce }: RulesPageCycleProps) {
  const { getSection, getParagraphs, loading } = useDynamicRules('RIVIERES');
  const section = getSection('full_cycle');
  const paragraphs = getParagraphs('full_cycle');

  // Extract dynamic content with fallbacks
  const dynamicContent = useMemo(() => {
    const steps = paragraphs.filter(p => p.id?.startsWith('rf2_step'))
      .map((p, i) => {
        const defaultStep = DEFAULT_STEPS[i] || DEFAULT_STEPS[0];
        return {
          num: i + 1,
          title: p.text?.match(/<strong>([^<]+)<\/strong>/)?.[1] || defaultStep.title,
          desc: p.text?.replace(/<[^>]+>/g, '') || defaultStep.desc,
          color: defaultStep.color,
        };
      });
    
    const endOfManche = paragraphs.find(p => p.id === 'rf2_end')?.text 
      || 'Après 5 niveaux (ou si tout le monde a chaviré), la manche se termine. Tous les joueurs reviennent sur le bateau pour la manche suivante avec leurs jetons actuels.';
    
    return { 
      steps: steps.length > 0 ? steps : DEFAULT_STEPS,
      endOfManche 
    };
  }, [paragraphs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {section?.title || 'Cycle de jeu'}
        </h1>
        <p className="text-[#9CA3AF]">Chaque niveau suit le même déroulement</p>
      </motion.div>

      {/* Structure overview */}
      <motion.div
        variants={itemVariants}
        className="bg-[#1a1f2e] rounded-xl p-6 border border-[#D4AF37]/20"
      >
        <div className="flex items-center gap-3 mb-4">
          <Repeat className="h-6 w-6 text-[#D4AF37]" />
          <h2 className="text-[#D4AF37] font-bold text-lg">Structure de la partie</h2>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <div className="bg-[#D4AF37]/20 rounded-lg px-4 py-2">
            <span className="text-[#D4AF37] font-bold">3 manches</span>
          </div>
          <ArrowRight className="h-4 w-4 text-[#9CA3AF]" />
          <div className="bg-blue-500/20 rounded-lg px-4 py-2">
            <span className="text-blue-400 font-bold">5 niveaux / manche</span>
          </div>
          <ArrowRight className="h-4 w-4 text-[#9CA3AF]" />
          <div className="bg-green-500/20 rounded-lg px-4 py-2">
            <span className="text-green-400 font-bold">= 15 niveaux total</span>
            <span className="text-green-400/70 text-xs block">(9 à réussir pour éviter des pénalités)</span>
          </div>
        </div>
      </motion.div>

      {/* Steps */}
      <motion.div variants={itemVariants}>
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#D4AF37]" />
          Déroulement d'un niveau
        </h2>
        
        <div className="space-y-3">
          {dynamicContent.steps.map((step, index) => (
            <motion.div
              key={step.num}
              variants={itemVariants}
              className={`flex items-start gap-4 bg-${step.color}-500/10 border border-${step.color}-500/30 rounded-lg p-4`}
            >
              <div className={`w-10 h-10 rounded-full bg-${step.color}-500 text-white font-bold flex items-center justify-center flex-shrink-0`}>
                {step.num}
              </div>
              <div>
                <h3 className={`text-${step.color}-400 font-bold mb-1`}>{step.title}</h3>
                <p className="text-[#E8E8E8] text-sm">{step.desc}</p>
              </div>
              {index < dynamicContent.steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-[#9CA3AF] self-center ml-auto hidden sm:block" />
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* End of manche */}
      <motion.div
        variants={itemVariants}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-3">
          <RotateCcw className="h-5 w-5 text-[#D4AF37]" />
          <h3 className="text-[#D4AF37] font-bold">Fin de manche</h3>
        </div>
        <p 
          className="text-[#E8E8E8] text-sm"
          dangerouslySetInnerHTML={{ __html: dynamicContent.endOfManche }}
        />
      </motion.div>
    </motion.div>
  );
}
