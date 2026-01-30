import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Syringe, Shield, Users, Skull, Trophy, Loader2 } from 'lucide-react';
import { INFECTION_ROLE_LABELS } from '@/components/infection/InfectionTheme';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

export function InfectionFullPageObjectif({ context, replayNonce }: Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('INFECTION');
  const section = getSection('full_objectif');
  const paragraphs = getParagraphs('full_objectif');

  const dynamicContent = useMemo(() => {
    const pvDesc = paragraphs.find(p => p.id === 'if1_pv_desc')?.text 
      || '2 joueurs infectés. Leur objectif : contaminer le village jusqu\'à ce qu\'il n\'y ait plus de joueurs sains non-immunisés.';
    const pvVictory = paragraphs.find(p => p.id === 'if1_pv_victory')?.text 
      || 'Tous les joueurs vivants non-PV sont immunisés (immune_permanent) ou ont les anticorps.';
    const syDesc = paragraphs.find(p => p.id === 'if1_sy_desc')?.text 
      || 'BA (Bras Armé), SY (Synthétistes), OC (Œil du Crépuscule). Ils travaillent ensemble pour éliminer les PV ou compléter la mission de recherche.';
    const syVictory = paragraphs.find(p => p.id === 'if1_sy_victory')?.text 
      || 'Mission SY réussie (trouver le joueur avec anticorps) OU tous les PV sont morts.';
    const propagation = paragraphs.find(p => p.id === 'if1_propagation')?.text 
      || 'À chaque manche, les porteurs contaminent leurs voisins (gauche/droite). Maximum 2 nouvelles infections par manche. Le virus saute les morts et s\'arrête si le voisin est déjà porteur.';
    
    return { pvDesc, pvVictory, syDesc, syVictory, propagation };
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
          {section?.title || 'Objectif & Camps'}
        </h2>
        <p className="text-[#9CA3AF]">
          Un virus mortel menace le village. Qui sauvera—ou détruira—la communauté ?
        </p>
      </div>

      {/* Camps overview */}
      <div className="grid gap-4">
        {/* PV */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <Skull className="h-6 w-6 text-[#B00020]" />
            <h3 className="font-bold text-[#B00020] text-lg">Porte-Venins (PV)</h3>
          </div>
          <p className="text-sm text-[#9CA3AF] mb-3" dangerouslySetInnerHTML={{ __html: dynamicContent.pvDesc }} />
          <div className="bg-[#0B0E14]/50 rounded p-2">
            <p className="text-xs text-[#B00020]">
              <strong>Victoire PV :</strong> <span dangerouslySetInnerHTML={{ __html: dynamicContent.pvVictory }} />
            </p>
          </div>
        </motion.div>

        {/* SY Team */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#2AB3A6]/10 border border-[#2AB3A6]/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <Shield className="h-6 w-6 text-[#2AB3A6]" />
            <h3 className="font-bold text-[#2AB3A6] text-lg">Équipe Synthétistes</h3>
          </div>
          <p className="text-sm text-[#9CA3AF] mb-3" dangerouslySetInnerHTML={{ __html: dynamicContent.syDesc }} />
          <div className="bg-[#0B0E14]/50 rounded p-2">
            <p className="text-xs text-[#2AB3A6]">
              <strong>Victoire NON-PV :</strong> <span dangerouslySetInnerHTML={{ __html: dynamicContent.syVictory }} />
            </p>
          </div>
        </motion.div>

        {/* Citoyens */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#6B7280]/10 border border-[#6B7280]/30 rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-6 w-6 text-[#6B7280]" />
            <h3 className="font-bold text-white text-lg">Citoyens & Neutres</h3>
          </div>
          <ul className="text-sm text-[#9CA3AF] space-y-1">
            <li><strong className="text-white">CV (Citoyen):</strong> Vote et peut corrompre l'AE</li>
            <li><strong className="text-white">KK (Sans Cercle):</strong> Veut mourir tôt pour marquer plus de PVic</li>
            <li><strong className="text-white">AE (Agent de l'État):</strong> Peut saboter le BA, corrompu par les autres</li>
          </ul>
        </motion.div>
      </div>

      {/* Key mechanic */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4"
      >
        <div className="flex items-center gap-3 mb-2">
          <Syringe className="h-5 w-5 text-[#D4AF37]" />
          <h4 className="font-semibold text-[#D4AF37]">Le virus se propage</h4>
        </div>
        <p className="text-sm text-[#9CA3AF]" dangerouslySetInnerHTML={{ __html: dynamicContent.propagation }} />
      </motion.div>
    </div>
  );
}
