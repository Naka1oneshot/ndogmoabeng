import { motion } from 'framer-motion';
import { Coins, CreditCard, ArrowDownRight, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { SheriffRulesContextData } from '../../useSheriffRulesContext';

interface SheriffQuickPage2Props {
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

export function SheriffQuickPage2({ context, replayNonce }: SheriffQuickPage2Props) {
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
        <div className="inline-flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-full px-4 py-1.5 mb-3">
          <CreditCard className="h-4 w-4 text-[#F59E0B]" />
          <span className="text-[#F59E0B] font-medium text-sm">Phase Visa & Jetons</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Préparer son Passage
        </h1>
      </motion.div>

      {/* Visa options */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[#D4AF37]" />
          Choix du Visa
        </h3>
        
        <div className="grid gap-3 sm:grid-cols-2">
          {/* PVic option */}
          <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="h-5 w-5 text-red-400" />
              <span className="font-bold text-[#D4AF37]">⭐ Points de Victoire</span>
            </div>
            <p className="text-sm text-[#E8E8E8]">
              Perdre <strong className="text-red-400">{context.visaPvicPercent}%</strong> de vos PVic actuels
            </p>
            <p className="text-xs text-[#9CA3AF] mt-2">
              Impact personnel, pas sur la cagnotte commune
            </p>
          </div>

          {/* Pool option */}
          <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-5 w-5 text-[#CD853F]" />
              <span className="font-bold text-[#CD853F]">💰 Cagnotte Commune</span>
            </div>
            <p className="text-sm text-[#E8E8E8]">
              Payer <strong className="text-[#CD853F]">{context.costPerPlayer}€</strong> depuis la cagnotte
            </p>
            <p className="text-xs text-[#9CA3AF] mt-2">
              Préserve vos PVic mais réduit le pot commun
            </p>
          </div>
        </div>

        {/* Floor warning */}
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#F59E0B]">
            La cagnotte ne descend jamais sous {context.floorPercent}% de sa valeur initiale (floor)
          </p>
        </div>
      </motion.div>

      {/* Tokens */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Coins className="h-5 w-5 text-[#D4AF37]" />
          Jetons Entrants
        </h3>
        
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Legal */}
          <div className="bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✓</span>
              <span className="font-bold text-[#4ADE80]">20 Jetons (Légal)</span>
            </div>
            <p className="text-sm text-[#E8E8E8]">
              Aucun risque — vous passez tranquillement
            </p>
          </div>

          {/* Illegal */}
          <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚠️</span>
              <span className="font-bold text-[#EF4444]">21-30 Jetons (Illégal)</span>
            </div>
            <p className="text-sm text-[#E8E8E8]">
              Risque de fouille — gain potentiel si vous passez
            </p>
          </div>
        </div>

        <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-lg p-4">
          <p className="text-sm text-[#E8E8E8]">
            <strong className="text-[#D4AF37]">Au départ:</strong> Tout le monde commence avec <strong>20 jetons</strong>. 
            C'est le choix des jetons entrants (21→30) qui crée le risque.
          </p>
        </div>
      </motion.div>

      {/* Quick summary */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 border border-[#D4AF37]/30 rounded-xl p-4"
      >
        <h4 className="font-bold text-[#D4AF37] mb-2">Résumé Phase 1</h4>
        <ul className="text-sm text-[#E8E8E8] space-y-1">
          <li>• Choisir <strong>comment</strong> payer le visa (PVic ou cagnotte)</li>
          <li>• Choisir <strong>combien</strong> de jetons entrer (20 légal, 21-30 illégal)</li>
          <li>• Attendre que le MJ verrouille pour passer aux duels</li>
        </ul>
      </motion.div>
    </motion.div>
  );
}
