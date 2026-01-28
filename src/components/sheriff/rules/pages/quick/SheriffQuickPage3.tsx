import { motion } from 'framer-motion';
import { Swords, Search, ArrowRight, Check, X, AlertTriangle, Users } from 'lucide-react';
import { SheriffRulesContextData } from '../../useSheriffRulesContext';

interface SheriffQuickPage3Props {
  context: SheriffRulesContextData;
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

export function SheriffQuickPage3({ context, replayNonce }: SheriffQuickPage3Props) {
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
        <div className="inline-flex items-center gap-2 bg-[#CD853F]/10 border border-[#CD853F]/30 rounded-full px-4 py-1.5 mb-3">
          <Swords className="h-4 w-4 text-[#CD853F]" />
          <span className="text-[#CD853F] font-medium text-sm">Phase Duels</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Duels & Dernier Duel
        </h1>
      </motion.div>

      {/* How duels work */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Search className="h-5 w-5 text-[#D4AF37]" />
          Déroulement d'un Duel
        </h3>
        
        <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg p-4 space-y-3">
          <p className="text-sm text-[#E8E8E8]">
            Deux joueurs (jamais coéquipiers) s'affrontent. Chacun choisit <strong>simultanément</strong>:
          </p>
          
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 bg-[#F59E0B]/10 rounded-lg p-2">
              <Search className="h-4 w-4 text-[#F59E0B]" />
              <span className="text-sm text-[#E8E8E8]">🔍 Fouiller</span>
            </div>
            <div className="flex items-center gap-2 bg-[#4ADE80]/10 rounded-lg p-2">
              <ArrowRight className="h-4 w-4 text-[#4ADE80]" />
              <span className="text-sm text-[#E8E8E8]">✋ Laisser passer</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Outcomes table */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-bold text-white">Résultats possibles</h3>
        
        <div className="space-y-2">
          {/* Search and find illegal */}
          <div className="bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-lg p-3 flex items-start gap-3">
            <Check className="h-5 w-5 text-[#4ADE80] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#4ADE80]">Fouille réussie (illégal trouvé)</p>
              <p className="text-xs text-[#E8E8E8]">
                Fouilleur: <strong className="text-[#4ADE80]">+{context.gainPerIllegalFound}%</strong> PVic par jeton illégal
              </p>
              <p className="text-xs text-[#E8E8E8]">
                Fouillé: <strong className="text-red-400">-{context.lossPerIllegalCaught}%</strong> PVic par jeton + confiscation
              </p>
            </div>
          </div>

          {/* Search but legal */}
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 flex items-start gap-3">
            <X className="h-5 w-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#EF4444]">Fouille ratée (légal)</p>
              <p className="text-xs text-[#E8E8E8]">
                Fouilleur: <strong className="text-red-400">-{context.lossSearchNoIllegal}%</strong> PVic (pénalité fixe)
              </p>
            </div>
          </div>

          {/* Pass but illegal */}
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#F59E0B]">Passage d'illégal (non fouillé)</p>
              <p className="text-xs text-[#E8E8E8]">
                L'illégal: <strong className="text-[#4ADE80]">+{context.gainPerIllegalPassed}%</strong> PVic par jeton passé
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Final Duel */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-bold text-[#F59E0B] flex items-center gap-2">
          <Users className="h-5 w-5" />
          Dernier Duel (nombre impair)
        </h3>
        
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-4 space-y-2">
          <p className="text-sm text-[#E8E8E8]">
            Si un joueur n'a pas eu de duel (nombre impair):
          </p>
          <ol className="text-sm text-[#E8E8E8] space-y-1 list-decimal list-inside">
            <li>Le joueur ayant <strong>perdu le plus de PVic</strong> est sélectionné</li>
            <li>Il <strong>re-choisit ses jetons entrants</strong> (21-30)</li>
            <li>Un <strong>dernier duel</strong> oppose ces deux joueurs</li>
          </ol>
          <p className="text-xs text-[#9CA3AF] mt-2">
            Tie-breaker: en cas d'égalité, le joueur avec le plus petit numéro
          </p>
        </div>
      </motion.div>

      {/* Token reset */}
      <motion.div
        variants={itemVariants}
        className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg p-4"
      >
        <p className="text-sm text-[#E8E8E8]">
          <strong className="text-[#D4AF37]">Après duel:</strong> Si un joueur est attrapé avec des jetons 
          illégaux, ses jetons sont <strong>remis à 20</strong>. Sinon, il garde ses jetons entrants.
        </p>
      </motion.div>
    </motion.div>
  );
}
