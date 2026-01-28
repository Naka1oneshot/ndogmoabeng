import { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Shield, DollarSign, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

export function InfectionFullPageTirsCorruption({ context, replayNonce }: Props) {
  // Corruption simulator
  const [nonPvAmount, setNonPvAmount] = useState(0);
  const [pvAmount, setPvAmount] = useState(0);

  const computeCorruptionResult = () => {
    // Base: if AE identifies BA correctly, sabotage is ON
    let sabotageActive = true;

    // Non-PV can pay ≥10 to disable sabotage
    if (nonPvAmount >= 10) {
      sabotageActive = false;
    }

    // PV can pay ≥15 to re-enable (override)
    if (pvAmount >= 15) {
      sabotageActive = true;
    }

    return {
      sabotageActive,
      aeBonus: nonPvAmount + pvAmount,
    };
  };

  const result = computeCorruptionResult();

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          Tirs & Corruption
        </h2>
        <p className="text-[#9CA3AF]">
          Résolution des tirs et mécanique de l'Agent de l'État
        </p>
      </div>

      {/* Tirs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <Target className="h-6 w-6 text-[#B00020]" />
          <h3 className="font-bold text-[#B00020]">Résolution des tirs</h3>
        </div>
        <ul className="space-y-2 text-sm text-[#9CA3AF]">
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-[#B00020] mt-0.5 shrink-0" />
            <span>Tirs résolus par <strong className="text-white">ordre de timestamp</strong> (premier arrivé, premier servi)</span>
          </li>
          <li className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-[#2AB3A6] mt-0.5 shrink-0" />
            <span><strong className="text-white">Gilet pare-balles</strong> : peut bloquer un tir</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#E6A23C]">⚠️</span>
            <span><strong className="text-[#E6A23C]">Exception</strong> : Si cible = <strong>clan Ezkar ET rôle KK</strong>, le gilet ne protège pas</span>
          </li>
        </ul>
        <div className="mt-3 bg-[#0B0E14] rounded p-2">
          <p className="text-xs text-[#9CA3AF]">
            Les morts sont annoncées en fin de manche avec révélation du rôle.
          </p>
        </div>
      </motion.div>

      {/* Corruption AE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <DollarSign className="h-6 w-6 text-[#D4AF37]" />
          <h3 className="font-bold text-[#D4AF37]">Corruption de l'Agent de l'État</h3>
        </div>
        
        <div className="space-y-3 text-sm text-[#9CA3AF]">
          <p>Si l'AE identifie correctement le BA, le <strong className="text-white">sabotage est actif par défaut</strong>.</p>
          
          <div className="grid gap-2">
            <div className="bg-[#0B0E14] rounded p-2">
              <span className="text-[#2AB3A6]">Non-PV paient ≥10 jetons</span>
              <span className="text-[#6B7280]"> → Annule le sabotage</span>
            </div>
            <div className="bg-[#0B0E14] rounded p-2">
              <span className="text-[#B00020]">PV paient ≥15 jetons</span>
              <span className="text-[#6B7280]"> → Réactive le sabotage (override)</span>
            </div>
          </div>

          <p className="text-xs">
            Tous les jetons payés (par les deux camps) sont ajoutés au <strong className="text-[#D4AF37]">PVic de l'AE</strong>.
          </p>
        </div>
      </motion.div>

      {/* Corruption simulator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
      >
        <h3 className="font-semibold text-white mb-3">Simulateur corruption</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">Non-PV paient</label>
            <div className="flex gap-1">
              {[0, 5, 10, 15, 20].map(v => (
                <Button
                  key={v}
                  size="sm"
                  variant={nonPvAmount === v ? 'default' : 'outline'}
                  onClick={() => setNonPvAmount(v)}
                  className={nonPvAmount === v ? 'bg-[#2AB3A6]' : ''}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">PV paient</label>
            <div className="flex gap-1">
              {[0, 5, 10, 15, 20].map(v => (
                <Button
                  key={v}
                  size="sm"
                  variant={pvAmount === v ? 'default' : 'outline'}
                  onClick={() => setPvAmount(v)}
                  className={pvAmount === v ? 'bg-[#B00020]' : ''}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className={`rounded p-3 text-center ${
          result.sabotageActive 
            ? 'bg-[#B00020]/20 border border-[#B00020]/50' 
            : 'bg-[#2AB3A6]/20 border border-[#2AB3A6]/50'
        }`}>
          <p className={`font-bold ${result.sabotageActive ? 'text-[#B00020]' : 'text-[#2AB3A6]'}`}>
            Sabotage : {result.sabotageActive ? '🔴 ACTIF' : '🟢 DÉSACTIVÉ'}
          </p>
          <p className="text-sm text-[#D4AF37] mt-1">
            Bonus AE : +{result.aeBonus} PVic
          </p>
        </div>
      </motion.div>
    </div>
  );
}
