import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, Eye, Syringe, FlaskConical, UserCog, Loader2 } from 'lucide-react';
import { INFECTION_ROLE_LABELS } from '@/components/infection/InfectionTheme';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';
import { useDynamicRules } from '@/hooks/useDynamicRules';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

const DEFAULT_ROLE_DETAILS = [
  {
    code: 'BA',
    icon: <Target className="h-5 w-5" />,
    actions: [
      "Reçoit 1 balle par manche (facultatif de tirer)",
      "Peut corrompre l'AE",
      "Objectif : éliminer les PV rapidement",
    ],
  },
  {
    code: 'OC',
    icon: <Eye className="h-5 w-5" />,
    actions: [
      "1 fois par manche : découvre le rôle d'un joueur (révélation privée)",
      "Peut partager l'info... ou mentir",
      "Peut corrompre l'AE",
    ],
  },
  {
    code: 'SY',
    icon: <FlaskConical className="h-5 w-5" />,
    actions: [
      "Recherche sur un joueur par manche",
      "Si le joueur a les anticorps : progression mission (+1)",
      "Mission réussie = victoire NON-PV",
      "Tous les SY doivent viser la même cible (unanime)",
    ],
  },
  {
    code: 'PV',
    icon: <Syringe className="h-5 w-5" />,
    actions: [
      "Manche 1 : désigne Patient 0 (obligatoire)",
      "1 antidote pour immuniser quelqu'un (dose unique)",
      "1 balle pour toute la partie",
      "Contamine les voisins à chaque manche",
    ],
  },
  {
    code: 'AE',
    icon: <UserCog className="h-5 w-5" />,
    actions: [
      "Peut identifier le BA (si correct : sabotage actif)",
      "Sabotage = l'arme du BA ne fonctionne pas",
      "Non-PV peuvent payer ≥10 jetons pour annuler le sabotage",
      "PV peuvent payer ≥15 jetons pour réactiver le sabotage",
      "Jetons reçus = bonus PVic pour l'AE",
    ],
  },
];

export function InfectionFullPageRoles({ context, replayNonce }: Props) {
  const { getSection, getParagraphs, loading } = useDynamicRules('INFECTION');
  const section = getSection('full_roles');
  const paragraphs = getParagraphs('full_roles');

  const roleDetails = useMemo(() => {
    // Use dynamic actions if available
    return DEFAULT_ROLE_DETAILS.map(role => {
      const dynamicActions = paragraphs.find(p => p.id === `if2_${role.code.toLowerCase()}_actions`)?.items;
      return {
        ...role,
        actions: dynamicActions || role.actions,
      };
    });
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
          {section?.title || 'Actions par rôle'}
        </h2>
        <p className="text-[#9CA3AF]">
          Ce que chaque rôle peut faire à chaque manche
        </p>
      </div>

      <div className="space-y-4">
        {roleDetails.map((role, i) => {
          const config = INFECTION_ROLE_LABELS[role.code];
          return (
            <motion.div
              key={role.code}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${config.color}20`, color: config.color }}
                >
                  {role.icon}
                </div>
                <div>
                  <h3 className="font-bold" style={{ color: config.color }}>
                    {config.name} ({config.short})
                  </h3>
                  <p className="text-xs text-[#6B7280]">{config.team}</p>
                </div>
              </div>
              <ul className="space-y-1 text-sm text-[#9CA3AF]">
                {role.actions.map((action, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span style={{ color: config.color }}>•</span>
                    <span dangerouslySetInnerHTML={{ __html: action }} />
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      {/* CV & KK note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-[#6B7280]/10 border border-[#6B7280]/30 rounded-lg p-4"
      >
        <h4 className="font-semibold text-white mb-2">CV (Citoyen) & KK (Sans Cercle)</h4>
        <p className="text-sm text-[#9CA3AF]">
          Pas d'action spéciale, mais peuvent voter au test anticorps et corrompre l'AE.
          Le KK a un objectif inverse : mourir tôt rapporte plus de PVic !
        </p>
      </motion.div>
    </div>
  );
}
