import { motion } from 'framer-motion';
import { Ship, Anchor, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { RivieresRulesContextData } from '../../useRivieresRulesContext';

interface RulesPageDecisionsProps {
  context: RivieresRulesContextData;
  replayNonce: number;
  onNavigate?: (index: number) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function RulesPageDecisions({ context, replayNonce }: RulesPageDecisionsProps) {
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Rester vs Descendre
        </h1>
        <p className="text-[#9CA3AF]">Le dilemme central du jeu</p>
      </motion.div>

      {/* Two choices */}
      <motion.div variants={itemVariants} className="grid sm:grid-cols-2 gap-6">
        {/* RESTER */}
        <div className="bg-blue-500/10 border-2 border-blue-500/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/30 flex items-center justify-center">
              <Ship className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-blue-400 font-bold text-xl">RESTER</h2>
              <span className="text-blue-400/70 text-sm">sur le bateau</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Vous partagez la cagnotte <strong>si le niveau 5 de la manche est réussi</strong>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Plus de joueurs restent = plus de mises pour contrer le danger
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Accès au bonus de 100 jetons au niveau 5
              </span>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Risque de tout perdre en cas de chavirement
              </span>
            </div>
          </div>
        </div>

        {/* DESCENDRE */}
        <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/30 flex items-center justify-center">
              <Anchor className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-amber-400 font-bold text-xl">DESCENDRE</h2>
              <span className="text-amber-400/70 text-sm">à terre</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Vous conservez vos jetons actuels en sécurité
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Vous partagerez des jetons en cas de chavirement du bateau durant la manche en cours
              </span>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Pas de gains si la manche est réussie (niveau 5 atteint)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#E8E8E8] text-sm">
                Vous sortez de la manche en cours
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Consequences */}
      <motion.div
        variants={itemVariants}
        className="bg-[#1a1f2e] rounded-xl p-6 border border-[#D4AF37]/20"
      >
        <h3 className="text-white font-bold text-lg mb-4">Conséquences selon le résultat</h3>
        
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Success at Level 5 */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h4 className="text-green-400 font-bold mb-2">Niveau 5 réussi (fin de manche)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-blue-400" />
                <span className="text-[#E8E8E8]">Restants : partagent la cagnotte + bonus 100</span>
              </div>
              <div className="flex items-center gap-2">
                <Anchor className="h-4 w-4 text-amber-400" />
                <span className="text-[#9CA3AF]">Descendus (cette manche) : 0 jetons</span>
              </div>
            </div>
          </div>
          
          {/* Failure */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <h4 className="text-red-400 font-bold mb-2">Chavirement</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Anchor className="h-4 w-4 text-amber-400" />
                <span className="text-[#E8E8E8]">Descendus (cette manche, incluant ce niveau) : partagent la cagnotte</span>
              </div>
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-blue-400" />
                <span className="text-[#9CA3AF]">Restants : 0 jetons</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key insight */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4"
      >
        <ArrowRight className="h-6 w-6 text-[#D4AF37] flex-shrink-0" />
        <p className="text-[#E8E8E8]">
          <span className="text-[#D4AF37] font-bold">Clé du jeu :</span> Anticipez les décisions des autres joueurs. 
          Si tout le monde descend, les mises seront faibles et le chavirement probable !
        </p>
      </motion.div>
    </motion.div>
  );
}
