import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Star, Skull, Heart, Target, FlaskConical, Loader2 } from 'lucide-react';
import { INFECTION_ROLE_LABELS } from '@/components/infection/InfectionTheme';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

export function InfectionFullPageRecompenses({ context, replayNonce }: Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('INFECTION');
  const section = getSection('full_recompenses');
  const paragraphs = getParagraphs('full_recompenses');

  const dynamicContent = useMemo(() => {
    const nonPvVictory = paragraphs.find(p => p.id === 'if5_nonpv_victory')?.text 
      || 'Mission SY réussie <strong class="text-white">OU</strong> tous les PV morts.<br /><span class="text-[#2AB3A6]">Bonus survivants : +20 PVic si tous les PV morts</span>';
    const pvVictory = paragraphs.find(p => p.id === 'if5_pv_victory')?.text 
      || 'Tous les joueurs vivants non-PV sont immunisés (immune_permanent) ou ont les anticorps.<br /><span class="text-[#B00020]">Récompense PV : +40 PVic</span>';
    const bonuses = paragraphs.find(p => p.id === 'if5_bonuses')?.items 
      || ['<strong class="text-white">Meilleurs soupçons :</strong> +10 PVic (partagé)', '<strong class="text-white">Vivant à la mort des PV :</strong> +10 PVic'];
    
    return { nonPvVictory, pvVictory, bonuses };
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
          {section?.title || 'Récompenses & PVic'}
        </h2>
        <p className="text-[#9CA3AF]">
          Comment marquer des points selon votre rôle
        </p>
      </div>

      {/* Victory conditions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-4"
      >
        <div className="bg-[#2AB3A6]/10 border border-[#2AB3A6]/30 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="h-5 w-5 text-[#2AB3A6]" />
            <h3 className="font-bold text-[#2AB3A6]">Victoire NON-PV</h3>
          </div>
          <p className="text-sm text-[#9CA3AF]" dangerouslySetInnerHTML={{ __html: dynamicContent.nonPvVictory }} />
        </div>

        <div className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Skull className="h-5 w-5 text-[#B00020]" />
            <h3 className="font-bold text-[#B00020]">Victoire PV</h3>
          </div>
          <p className="text-sm text-[#9CA3AF]" dangerouslySetInnerHTML={{ __html: dynamicContent.pvVictory }} />
        </div>
      </motion.div>

      {/* Rewards by role */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Star className="h-5 w-5 text-[#D4AF37]" />
          Détail par rôle
        </h3>

        {Object.entries(INFECTION_ROLE_LABELS).map(([code, config]) => (
          <div 
            key={code}
            className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span 
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{ backgroundColor: `${config.color}20`, color: config.color }}
              >
                {config.short}
              </span>
              <span className="font-medium text-white text-sm">{config.name}</span>
            </div>
            <div className="space-y-1">
              {config.victoryConditions.map((vc, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-[#9CA3AF]">{vc.condition}</span>
                  <span className="text-[#D4AF37] font-medium">
                    {vc.pvic > 0 ? `+${vc.pvic}` : 'Variable'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Bonus votes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4"
      >
        <h4 className="font-semibold text-[#D4AF37] mb-2">Bonus additionnels</h4>
        <ul className="space-y-1 text-sm text-[#9CA3AF]">
          {dynamicContent.bonuses.map((bonus, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: bonus }} />
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
