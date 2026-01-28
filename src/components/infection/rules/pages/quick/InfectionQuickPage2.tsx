import { motion } from 'framer-motion';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

export function InfectionQuickPage2({ context, replayNonce }: Props) {
  const steps = [
    { num: 1, title: "Actions", desc: "Chaque rôle soumet ses actions secrètement", color: "#D4AF37" },
    { num: 2, title: "Corruption", desc: "L'AE peut saboter le BA (seuils 10/15 jetons)", color: "#E6A23C" },
    { num: 3, title: "Tirs", desc: "Résolus par ordre de timestamp, gilet possible", color: "#B00020" },
    { num: 4, title: "Test anticorps", desc: "Vote pour tester un joueur (résultat privé)", color: "#2AB3A6" },
    { num: 5, title: "Recherche SY", desc: "Les SY cherchent le joueur avec anticorps", color: "#2AB3A6" },
    { num: 6, title: "Propagation", desc: "Max 2 nouvelles infections (gauche/droite)", color: "#B00020" },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          Déroulé d'une manche
        </h2>
        <p className="text-[#9CA3AF]">
          6 étapes clés à chaque tour
        </p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#2D3748]" />

        <div className="space-y-4">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4 relative"
            >
              {/* Circle */}
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 z-10"
                style={{ backgroundColor: `${step.color}20`, color: step.color, border: `2px solid ${step.color}` }}
              >
                {step.num}
              </div>

              {/* Content */}
              <div className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-3 flex-1">
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-[#9CA3AF]">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-4"
      >
        <p className="text-sm text-[#B00020] font-medium">
          ⚠️ Patient 0 : Manche 1, les PV doivent obligatoirement choisir une cible. 
          Elle est infectée <strong>avant</strong> les tirs.
        </p>
      </motion.div>
    </div>
  );
}
