import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Ship, Target, Trophy, Coins, Loader2 } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';
import { DynamicSection } from '@/components/rules/DynamicSection';

interface RulesPageObjectiveProps {
  context: RivieresRulesContextData;
  replayNonce: number;
  onNavigate?: (index: number) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function RulesPageObjective({ context, replayNonce }: RulesPageObjectiveProps) {
  const { getSection, getParagraphs, loading } = useDynamicRules('RIVIERES');
  const section = getSection('full_objectif');
  const paragraphs = getParagraphs('full_objectif');

  // Extract specific texts from dynamic content
  const dynamicContent = useMemo(() => {
    const mainObjective = paragraphs.find(p => p.id === 'rf1_objectif')?.text 
      || 'Votre objectif est d\'accumuler un maximum de <span class="text-[#D4AF37] font-bold">jetons</span> en naviguant sur les rivières dangereuses de Ndogmoabeng.';
    const howToWinStay = paragraphs.find(p => p.id === 'rf1_win_stay')?.text 
      || '<span class="text-blue-400 font-medium">En restant sur le bateau :</span> Si le niveau 5 d\'une manche est réussi, les restants partagent la cagnotte.';
    const howToWinLeave = paragraphs.find(p => p.id === 'rf1_win_leave')?.text 
      || '<span class="text-amber-400 font-medium">En descendant à terre :</span> Si le bateau chavire durant la manche, les descendus partagent la cagnotte.';
    const theme = paragraphs.find(p => p.id === 'rf1_theme')?.text 
      || 'Vous êtes un voyageur sur les rivières du nord de Ndogmoabeng, territoire de la <span class="text-blue-400 font-medium">Maison des Keryndes</span>. Les rivières sont dangereuses et imprévisibles. À chaque niveau, vous devez décider si vous restez sur le bateau pour tenter de dompter les eaux, ou si vous descendez à terre en anticipant le drame.';
    
    return { mainObjective, howToWinStay, howToWinLeave, theme };
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
        <div className="inline-flex items-center gap-3 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-6 py-2 mb-4">
          <Ship className="h-6 w-6 text-[#D4AF37]" />
          <span className="text-[#D4AF37] font-bold text-lg">Les Rivières de Ndogmoabeng</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {section?.title || 'Objectif du jeu'}
        </h1>
      </motion.div>

      {/* Main objective */}
      <motion.div
        variants={itemVariants}
        className="bg-[#1a1f2e] rounded-xl p-6 border border-[#D4AF37]/20"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-[#D4AF37]/20 flex items-center justify-center flex-shrink-0">
            <Target className="h-7 w-7 text-[#D4AF37]" />
          </div>
          <div>
            <h2 className="text-[#D4AF37] font-bold text-xl mb-3">Accumuler des jetons</h2>
            <p 
              className="text-[#E8E8E8] text-lg leading-relaxed"
              dangerouslySetInnerHTML={{ __html: dynamicContent.mainObjective }}
            />
          </div>
        </div>
      </motion.div>

      {/* How to win */}
      <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Trophy className="h-6 w-6 text-green-400" />
            <h3 className="text-green-400 font-bold">Pour gagner</h3>
          </div>
          <p className="text-[#E8E8E8]">
            Terminez la partie avec le plus de jetons possible. Le joueur avec le plus de jetons 
            <span className="text-[#D4AF37] font-bold"> après déduction de l'impact du nombre de niveaux réussis</span> remporte la victoire.
          </p>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Coins className="h-6 w-6 text-blue-400" />
            <h3 className="text-blue-400 font-bold">Comment gagner des jetons</h3>
          </div>
          <div className="text-[#E8E8E8] space-y-2">
            <p dangerouslySetInnerHTML={{ __html: dynamicContent.howToWinStay }} />
            <p dangerouslySetInnerHTML={{ __html: dynamicContent.howToWinLeave }} />
          </div>
        </div>
      </motion.div>

      {/* Theme */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-blue-500/10 to-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl p-6"
      >
        <h3 className="text-white font-bold text-lg mb-3">Le thème</h3>
        <p 
          className="text-[#E8E8E8] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: dynamicContent.theme }}
        />
      </motion.div>

      {/* Key numbers */}
      <motion.div variants={itemVariants}>
        <h3 className="text-white font-bold text-lg mb-4">Chiffres clés</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1a1f2e] rounded-lg p-4 text-center">
            <span className="text-3xl font-bold text-[#D4AF37]">3</span>
            <p className="text-[#9CA3AF] text-sm mt-1">manches</p>
          </div>
          <div className="bg-[#1a1f2e] rounded-lg p-4 text-center">
            <span className="text-3xl font-bold text-[#D4AF37]">15</span>
            <p className="text-[#9CA3AF] text-sm mt-1">niveaux total</p>
          </div>
          <div className="bg-[#1a1f2e] rounded-lg p-4 text-center">
            <span className="text-3xl font-bold text-[#D4AF37]">9</span>
            <p className="text-[#9CA3AF] text-sm mt-1">à réussir (éviter pénalités)</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
