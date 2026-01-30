import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Skull, Shield, Loader2 } from 'lucide-react';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

const DEFAULT_TIPS = [
  '<strong class="text-white">Propagation max 2:</strong> Même si plusieurs porteurs contaminent, max 2 nouvelles infections par manche.',
  '<strong class="text-white">Antidote:</strong> Immunise définitivement, mais si la cible est déjà porteuse, elle le reste et continue de contaminer.',
  '<strong class="text-white">Test anticorps:</strong> Seul le joueur testé reçoit son résultat en privé.',
  '<strong class="text-white">Corruption AE:</strong> Non-PV paient ≥10 pour annuler le sabotage, PV paient ≥15 pour le réactiver.',
  '<strong class="text-white">Exception gilet:</strong> Si la cible est clan Ezkar ET rôle KK, le gilet ne protège pas.',
];

export function InfectionQuickPage3({ context, replayNonce }: Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('INFECTION');
  const section = getSection('quick_victoire');
  const paragraphs = getParagraphs('quick_victoire');

  const dynamicContent = useMemo(() => {
    const pvVictory = paragraphs.find(p => p.id === 'iq3_pv_victory')?.text 
      || 'Tous les joueurs vivants non-PV sont soit immunisés (immune_permanent), soit ont les anticorps.';
    const nonPvVictory = paragraphs.find(p => p.id === 'iq3_nonpv_victory')?.text 
      || 'Mission SY réussie (trouver le joueur avec anticorps 2-3 fois) <strong>OU</strong> tous les PV sont morts.';
    const tips = paragraphs.find(p => p.id === 'iq3_tips')?.items || DEFAULT_TIPS;
    
    return { pvVictory, nonPvVictory, tips };
  }, [paragraphs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          {section?.title || 'Victoire & Astuces'}
        </h2>
        <p className="text-[#9CA3AF]">
          Comment gagner et conseils clés
        </p>
      </div>

      {/* Victory conditions */}
      <div className="grid gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <Skull className="h-6 w-6 text-[#B00020]" />
            <h3 className="font-bold text-[#B00020]">Victoire PV</h3>
          </div>
          <p className="text-sm text-[#9CA3AF]" dangerouslySetInnerHTML={{ __html: dynamicContent.pvVictory }} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#2AB3A6]/10 border border-[#2AB3A6]/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-6 w-6 text-[#2AB3A6]" />
            <h3 className="font-bold text-[#2AB3A6]">Victoire NON-PV</h3>
          </div>
          <p className="text-sm text-[#9CA3AF]" dangerouslySetInnerHTML={{ __html: dynamicContent.nonPvVictory }} />
        </motion.div>
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <h3 className="font-semibold text-[#D4AF37] flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Astuces importantes
        </h3>

        <ul className="space-y-2 text-sm text-[#9CA3AF]">
          {dynamicContent.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-[#D4AF37]">•</span>
              <span dangerouslySetInnerHTML={{ __html: tip }} />
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
