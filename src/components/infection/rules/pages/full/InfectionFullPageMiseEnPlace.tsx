import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Shuffle, Syringe, Shield, Loader2 } from 'lucide-react';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

export function InfectionFullPageMiseEnPlace({ context, replayNonce }: Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('INFECTION');
  const section = getSection('full_mise_en_place');
  const paragraphs = getParagraphs('full_mise_en_place');

  const dynamicContent = useMemo(() => {
    const requirements = paragraphs.find(p => p.id === 'if3_requirements')?.items 
      || ['<strong class="text-white">Minimum 7 joueurs</strong> (recommandé : 9-12)', 'Chaque joueur reçoit un numéro (1 à N) visible de tous', 'Distribution de jetons de départ (configurable par le MJ)'];
    const patient0 = paragraphs.find(p => p.id === 'if3_patient0')?.text 
      || 'Les PV doivent <strong class="text-white">obligatoirement</strong> désigner un Patient 0 à la manche 1. Cette cible est infectée <strong class="text-white">avant</strong> la résolution des tirs.';
    
    return { requirements, patient0 };
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
          {section?.title || 'Mise en place'}
        </h2>
        <p className="text-[#9CA3AF]">
          Comment se prépare une partie INFECTION
        </p>
      </div>

      {/* Requirements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
      >
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#D4AF37]" />
          Prérequis
        </h3>
        <ul className="space-y-2 text-sm text-[#9CA3AF]">
          {dynamicContent.requirements.map((req, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: `• ${req}` }} />
          ))}
        </ul>
      </motion.div>

      {/* Role distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
      >
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-[#D4AF37]" />
          Distribution des rôles
        </h3>
        <p className="text-sm text-[#9CA3AF] mb-3">
          Les rôles sont distribués secrètement par le système. Composition typique :
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-[#B00020]/20 rounded p-2">
            <span className="text-[#B00020] font-medium">2 PV</span>
          </div>
          <div className="bg-[#2AB3A6]/20 rounded p-2">
            <span className="text-[#2AB3A6] font-medium">1 BA</span>
          </div>
          <div className="bg-[#2AB3A6]/20 rounded p-2">
            <span className="text-[#2AB3A6] font-medium">1-2 SY</span>
          </div>
          <div className="bg-[#2AB3A6]/20 rounded p-2">
            <span className="text-[#2AB3A6] font-medium">1 OC</span>
          </div>
          <div className="bg-[#D4AF37]/20 rounded p-2">
            <span className="text-[#D4AF37] font-medium">1 AE</span>
          </div>
          <div className="bg-[#6B7280]/20 rounded p-2">
            <span className="text-[#6B7280] font-medium">1 KK + CV</span>
          </div>
        </div>
        <p className="text-xs text-[#6B7280] mt-2">
          Le nombre exact varie selon le total de joueurs.
        </p>
      </motion.div>

      {/* Starting items */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
      >
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#D4AF37]" />
          Inventaire de départ (par rôle)
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-[#2D3748] pb-2">
            <span className="text-[#B00020]">PV</span>
            <span className="text-[#9CA3AF]">1 dose venin + 1 antidote + 1 balle</span>
          </div>
          <div className="flex justify-between border-b border-[#2D3748] pb-2">
            <span className="text-[#2AB3A6]">BA</span>
            <span className="text-[#9CA3AF]">1 arme (1 balle/manche)</span>
          </div>
          <div className="flex justify-between border-b border-[#2D3748] pb-2">
            <span className="text-[#2AB3A6]">OC</span>
            <span className="text-[#9CA3AF]">1 boule de cristal/manche</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#D4AF37]">Clan Ezkar</span>
            <span className="text-[#9CA3AF]">+Antidote Ezkar + Gilet pare-balles</span>
          </div>
        </div>
      </motion.div>

      {/* Patient 0 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-4"
      >
        <div className="flex items-center gap-3 mb-2">
          <Syringe className="h-5 w-5 text-[#B00020]" />
          <h4 className="font-semibold text-[#B00020]">Patient 0 (Manche 1)</h4>
        </div>
        <p className="text-sm text-[#9CA3AF]" dangerouslySetInnerHTML={{ __html: dynamicContent.patient0 }} />
      </motion.div>
    </div>
  );
}
