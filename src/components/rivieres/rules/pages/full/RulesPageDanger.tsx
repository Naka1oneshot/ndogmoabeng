import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Dice6, Shield, Zap, Ship, Anchor, Loader2 } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface RulesPageDangerProps {
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

export function RulesPageDanger({ context, replayNonce }: RulesPageDangerProps) {
  const { getSection, getParagraphs, loading } = useDynamicRules('RIVIERES');
  const section = getSection('full_danger');
  const paragraphs = getParagraphs('full_danger');

  // Extract dynamic content with fallbacks
  const dynamicContent = useMemo(() => {
    const determination = paragraphs.find(p => p.id === 'rf4_determination')?.text 
      || 'Le MJ lance des dés (généralement 3 à 5) pour déterminer le danger. Le nombre de joueurs et la manche influencent la plage de danger.';
    const protection = paragraphs.find(p => p.id === 'rf4_protection')?.text 
      || 'Les mises des joueurs qui restent s\'additionnent. Si le total des mises ≥ danger, le niveau est passé.';
    const successItems = paragraphs.find(p => p.id === 'rf4_success')?.items 
      || ['Le bateau passe au niveau suivant', '<strong>Niveaux 1-4 :</strong> La cagnotte s\'accumule (pas de distribution)', '<strong>Niveau 5 uniquement :</strong> La cagnotte est partagée entre les restants + bonus 100', 'La cagnotte repart à 0 après le niveau 5'];
    const failureItems = paragraphs.find(p => p.id === 'rf4_failure')?.items 
      || ['Le bateau chavire', 'La cagnotte est partagée entre les descendus (cette manche, incluant ce niveau)', 'Les restants perdent tout', 'La manche se termine immédiatement'];
    
    return { determination, protection, successItems, failureItems };
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
          {section?.title || 'Danger & Chavirement'}
        </h1>
        <p className="text-[#9CA3AF]">Comment le danger est déterminé et ses conséquences</p>
      </motion.div>

      {/* How danger works */}
      <motion.div
        variants={itemVariants}
        className="bg-red-500/10 border border-red-500/30 rounded-xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-400" />
          <h2 className="text-red-400 font-bold text-lg">Comment fonctionne le danger</h2>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-[#0B1020] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Dice6 className="h-5 w-5 text-[#D4AF37]" />
              <h3 className="text-white font-medium">Détermination</h3>
            </div>
            <p 
              className="text-[#9CA3AF] text-sm"
              dangerouslySetInnerHTML={{ __html: dynamicContent.determination }}
            />
          </div>
          
          <div className="bg-[#0B1020] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <h3 className="text-white font-medium">Protection</h3>
            </div>
            <p 
              className="text-[#9CA3AF] text-sm"
              dangerouslySetInnerHTML={{ __html: dynamicContent.protection }}
            />
          </div>
        </div>
      </motion.div>

      {/* Comparison */}
      <motion.div variants={itemVariants}>
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#D4AF37]" />
          La confrontation
        </h2>
        
        <div className="bg-[#1a1f2e] rounded-xl p-4 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="bg-blue-500/20 rounded-lg px-6 py-3">
              <p className="text-blue-400 text-sm mb-1">Total des mises</p>
              <p className="text-white font-bold text-2xl">42</p>
            </div>
            
            <div className="text-2xl font-bold text-white">vs</div>
            
            <div className="bg-red-500/20 rounded-lg px-6 py-3">
              <p className="text-red-400 text-sm mb-1">Danger révélé</p>
              <p className="text-white font-bold text-2xl">38</p>
            </div>
          </div>
          
          <div className="mt-4 bg-green-500/20 rounded-lg px-4 py-2 inline-block">
            <span className="text-green-400 font-bold">42 ≥ 38 = SUCCÈS !</span>
          </div>
        </div>
      </motion.div>

      {/* Outcomes */}
      <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
        {/* Success */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
          <h3 className="text-green-400 font-bold mb-3 flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Succès (Mises ≥ Danger)
          </h3>
          <ul className="text-[#E8E8E8] text-sm space-y-2">
            {dynamicContent.successItems.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
            ))}
          </ul>
        </div>
        
        {/* Failure */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Chavirement (Mises &lt; Danger)
          </h3>
          <ul className="text-[#E8E8E8] text-sm space-y-2">
            {dynamicContent.failureItems.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Difficulty progression */}
      <motion.div
        variants={itemVariants}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-5"
      >
        <h3 className="text-[#D4AF37] font-bold mb-3">Progression de la difficulté</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-500/20 rounded-lg p-3">
            <p className="text-green-400 font-bold">Manche 1</p>
            <p className="text-[#9CA3AF] text-xs">Facile</p>
          </div>
          <div className="bg-amber-500/20 rounded-lg p-3">
            <p className="text-amber-400 font-bold">Manche 2</p>
            <p className="text-[#9CA3AF] text-xs">Modéré</p>
          </div>
          <div className="bg-red-500/20 rounded-lg p-3">
            <p className="text-red-400 font-bold">Manche 3</p>
            <p className="text-[#9CA3AF] text-xs">Difficile</p>
          </div>
        </div>
        <p className="text-[#9CA3AF] text-xs text-center mt-3">
          Le niveau 5 de chaque manche a un multiplicateur de danger plus élevé.
        </p>
      </motion.div>
    </motion.div>
  );
}
