import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, Target, Users, Star, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { SheriffRulesContextData } from '../../useSheriffRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface SheriffQuickPage1Props {
  context: SheriffRulesContextData;
  replayNonce: number;
  onNavigate?: (index: number) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const DEFAULT_STEPS = [
  { num: '1', title: 'Visa', desc: 'Payer avec vos PVic ou la cagnotte commune', color: '#F59E0B' },
  { num: '2', title: 'Jetons', desc: 'Choisir d\'entrer avec 20 (légal) ou plus (illégal)', color: '#D4AF37' },
  { num: '3', title: 'Duels', desc: 'Fouiller ou laisser passer votre adversaire', color: '#CD853F' },
];

export function SheriffQuickPage1({ replayNonce }: SheriffQuickPage1Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('SHERIFF');
  const section = getSection('quick_objectif');
  const paragraphs = getParagraphs('quick_objectif');

  const dynamicContent = useMemo(() => {
    const mission = paragraphs.find(p => p.id === 'sq1_mission')?.text 
      || 'Traversez le <strong>contrôle d\'entrée</strong> en gérant vos jetons et en décidant si vous fouillez les autres voyageurs. <strong>Le binôme avec le plus de Points de Victoire</strong> à la fin de la manche gagne !';
    const teamDesc = paragraphs.find(p => p.id === 'sq1_teams')?.text 
      || 'Les joueurs sont répartis en <strong class="text-[#D4AF37]">binômes</strong>. Chaque binôme partage le même objectif : maximiser le <strong>PVic total combiné</strong>.';
    const victoryHint = paragraphs.find(p => p.id === 'sq1_victory')?.text 
      || 'Le <strong>binôme</strong> avec le PVic total le plus élevé après visa + duels remporte la manche.';
    
    return { mission, teamDesc, victoryHint };
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
        <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-4 py-1.5 mb-3">
          <Shield className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-[#D4AF37] font-medium text-sm">Le Shérif de Ndogmoabeng</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {section?.title || 'Objectif du Jeu'}
        </h1>
        <p className="text-[#9CA3AF]">
          Franchissez le contrôle et maximisez vos Points de Victoire
        </p>
      </motion.div>

      {/* Main objective */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/30 rounded-xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#D4AF37] rounded-full flex items-center justify-center flex-shrink-0">
            <Target className="h-6 w-6 text-[#1A1510]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#D4AF37] mb-2">Votre Mission</h3>
            <p className="text-[#E8E8E8]" dangerouslySetInnerHTML={{ __html: dynamicContent.mission }} />
          </div>
        </div>
      </motion.div>

      {/* Teams */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="h-5 w-5 text-[#CD853F]" />
          Équipes & Binômes
        </h3>
        
        <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg p-4">
          <p className="text-[#E8E8E8] text-sm" dangerouslySetInnerHTML={{ __html: dynamicContent.teamDesc }} />
          <div className="mt-3 flex items-center gap-2 text-xs text-[#9CA3AF]">
            <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
            <span>Les coéquipiers ne s'affrontent jamais en duel</span>
          </div>
        </div>
      </motion.div>

      {/* Quick flow */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-bold text-white">Une manche en 3 étapes</h3>
        
        <div className="grid gap-3">
          {DEFAULT_STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              variants={itemVariants}
              className="flex items-center gap-3 bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg p-3"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: `${step.color}20`, color: step.color }}
              >
                {step.num}
              </div>
              <div className="flex-1">
                <span className="font-medium text-[#E8E8E8]">{step.title}</span>
                <span className="text-[#9CA3AF] text-sm ml-2">— {step.desc}</span>
              </div>
              {i < 2 && <ArrowRight className="h-4 w-4 text-[#9CA3AF]" />}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Victory hint */}
      <motion.div
        variants={itemVariants}
        className="bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-lg p-4 flex items-start gap-3"
      >
        <Star className="h-5 w-5 text-[#4ADE80] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[#4ADE80] font-medium text-sm">Condition de victoire</p>
          <p className="text-[#E8E8E8] text-sm mt-1" dangerouslySetInnerHTML={{ __html: dynamicContent.victoryHint }} />
        </div>
      </motion.div>
    </motion.div>
  );
}
