import { motion } from 'framer-motion';
import { Star, Ship, Anchor, AlertTriangle, Coins, Trophy } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';

interface RulesPageSummaryProps {
  context: RivieresRulesContextData;
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

const SUMMARY_POINTS = [
  {
    icon: Ship,
    title: 'RESTER sur le bateau',
    desc: 'Vous misez et participez au partage si le niveau passe. Risque de tout perdre si chavirement.',
    color: 'blue',
  },
  {
    icon: Anchor,
    title: 'DESCENDRE à terre',
    desc: 'Vous sécurisez vos jetons et partagez si le bateau chavire. Pas de gain sinon.',
    color: 'amber',
  },
  {
    icon: AlertTriangle,
    title: 'Le danger',
    desc: 'Si mises totales < danger, chavirement ! Les descendus (ce niveau) partagent la cagnotte.',
    color: 'red',
  },
  {
    icon: Coins,
    title: 'Distribution',
    desc: 'Gain = floor(Cagnotte ÷ Nb bénéficiaires). Bonus de 100 jetons au niveau 5.',
    color: 'green',
  },
];

export function RulesPageSummary({ context, replayNonce }: RulesPageSummaryProps) {
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
          <Star className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-[#D4AF37] font-medium text-sm">Récapitulatif</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Résumé rapide
        </h1>
        <p className="text-[#9CA3AF]">Tout ce qu'il faut retenir en un coup d'œil</p>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-4">
        {SUMMARY_POINTS.map((point, i) => {
          const Icon = point.icon;
          return (
            <motion.div
              key={i}
              variants={itemVariants}
              className={`bg-${point.color}-500/10 border border-${point.color}-500/30 rounded-xl p-5`}
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon className={`h-6 w-6 text-${point.color}-400`} />
                <h3 className={`text-${point.color}-400 font-bold`}>{point.title}</h3>
              </div>
              <p className="text-[#E8E8E8] text-sm">{point.desc}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Structure reminder */}
      <motion.div
        variants={itemVariants}
        className="bg-[#1a1f2e] rounded-xl p-6 border border-[#D4AF37]/20"
      >
        <h3 className="text-white font-bold text-lg mb-4">Structure de la partie</h3>
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <div className="bg-[#D4AF37]/20 rounded-lg px-4 py-3">
            <span className="text-[#D4AF37] font-bold text-xl">3</span>
            <span className="text-[#9CA3AF] text-sm block">manches</span>
          </div>
          <span className="text-[#9CA3AF]">×</span>
          <div className="bg-blue-500/20 rounded-lg px-4 py-3">
            <span className="text-blue-400 font-bold text-xl">5</span>
            <span className="text-[#9CA3AF] text-sm block">niveaux</span>
          </div>
          <span className="text-[#9CA3AF]">=</span>
          <div className="bg-green-500/20 rounded-lg px-4 py-3">
            <span className="text-green-400 font-bold text-xl">15</span>
            <span className="text-[#9CA3AF] text-sm block">confrontations max</span>
          </div>
        </div>
      </motion.div>

      {/* Tips */}
      <motion.div
        variants={itemVariants}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-5"
      >
        <div className="flex items-center gap-3 mb-3">
          <Trophy className="h-6 w-6 text-[#D4AF37]" />
          <h3 className="text-[#D4AF37] font-bold">Conseils pour gagner</h3>
        </div>
        <ul className="text-[#E8E8E8] text-sm space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-[#D4AF37]">•</span>
            <span>Observez les tendances des autres joueurs avant de décider</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#D4AF37]">•</span>
            <span>Prenez plus de risques en manche 1 (danger plus faible)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#D4AF37]">•</span>
            <span>Le niveau 5 vaut le risque : bonus de 100 jetons !</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#D4AF37]">•</span>
            <span>Si beaucoup descendent, le chavirement devient probable</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#D4AF37]">•</span>
            <span>Utilisez les pouvoirs de votre clan au bon moment</span>
          </li>
        </ul>
      </motion.div>
    </motion.div>
  );
}
