import { motion } from 'framer-motion';
import { Syringe, Users, Target, Trophy } from 'lucide-react';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';
import { DynamicSection } from '@/components/rules/DynamicSection';

interface DynamicInfectionQuickPage1Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

export function DynamicInfectionQuickPage1({ context, replayNonce }: DynamicInfectionQuickPage1Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('INFECTION');
  const section = getSection('quick_objectif');

  const items = [
    {
      icon: <Syringe className="h-6 w-6 text-[#B00020]" />,
      title: "Les Porte-Venins (PV)",
      content: "2 joueurs infectés qui veulent contaminer tout le village. Ils choisissent un Patient 0 (obligatoire manche 1).",
    },
    {
      icon: <Target className="h-6 w-6 text-[#2AB3A6]" />,
      title: "L'équipe saine",
      content: "Le Bras Armé (BA) tire, les Synthétistes (SY) cherchent l'antidote, l'Œil du Crépuscule (OC) révèle les rôles.",
    },
    {
      icon: <Users className="h-6 w-6 text-[#6B7280]" />,
      title: "Les autres",
      content: "Citoyens (CV), Sans Cercle (KK), et l'Agent de l'État (AE) qui peut saboter le BA.",
    },
    {
      icon: <Trophy className="h-6 w-6 text-[#D4AF37]" />,
      title: "Victoire",
      content: "PV gagnent si tous les vivants sont infectés/immunisés. NON-PV gagnent si mission SY réussie OU tous les PV morts.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          {section?.title || 'Objectif & Équipes'}
        </h2>
        <p className="text-[#9CA3AF]">
          Un virus se propage... Qui survivra ?
        </p>
      </div>

      {/* Dynamic Content if available */}
      {!loading && section && getParagraphs('quick_objectif').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#121A2B] border border-[#D4AF37]/30 rounded-lg p-4 mb-4"
        >
          <DynamicSection 
            paragraphs={getParagraphs('quick_objectif')} 
            textClassName="text-[#E8E8E8]"
            listClassName="text-[#9CA3AF]"
          />
        </motion.div>
      )}

      <div className="grid gap-4">
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4 flex gap-4"
          >
            <div className="shrink-0">{item.icon}</div>
            <div>
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-[#9CA3AF]">{item.content}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {!context.isDemo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4 text-center"
        >
          <p className="text-[#D4AF37] text-sm">
            Dans cette partie : {context.totalPlayers} joueurs • Manche {context.manche}
          </p>
        </motion.div>
      )}
    </div>
  );
}
