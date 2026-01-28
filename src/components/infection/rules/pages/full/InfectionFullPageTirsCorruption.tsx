import { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, Shield, DollarSign, Clock, Crosshair, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

interface CorruptionResult {
  sabotageActive: boolean;
  aeBonus: number;
  nonPvReimbursed: number;
  pvReimbursed: number;
  explanation: string;
}

export function InfectionFullPageTirsCorruption({ context, replayNonce }: Props) {
  const [nonPvAmount, setNonPvAmount] = useState(0);
  const [pvAmount, setPvAmount] = useState(0);

  const computeCorruptionResult = (): CorruptionResult => {
    // Logique de corruption selon les seuils:
    // - Par défaut: sabotage actif (AE a identifié BA)
    // - Non-PV peuvent payer ≥10 pour désactiver
    // - PV peuvent payer ≥15 pour réactiver (override)
    
    // Cas 1: PV >= 15 (override) → Sabotage ON, PV payent, Non-PV remboursés
    if (pvAmount >= 15) {
      return {
        sabotageActive: true,
        aeBonus: pvAmount,
        nonPvReimbursed: nonPvAmount,
        pvReimbursed: 0,
        explanation: 'PV ont atteint le seuil override (≥15). Sabotage réactivé. Non-PV remboursés.'
      };
    }
    
    // Cas 2: Non-PV >= 10 (et PV < 15) → Sabotage OFF, Non-PV convertis en PVic, PV remboursés
    if (nonPvAmount >= 10) {
      return {
        sabotageActive: false,
        aeBonus: nonPvAmount,
        nonPvReimbursed: 0,
        pvReimbursed: pvAmount,
        explanation: 'Non-PV ont atteint le seuil (≥10) et PV n\'ont pas contré (< 15). Sabotage annulé. Jetons Non-PV → AE, PV remboursés.'
      };
    }
    
    // Cas 3: Aucun seuil atteint → Sabotage ON (défaut), tous les jetons vont à AE
    return {
      sabotageActive: true,
      aeBonus: nonPvAmount + pvAmount,
      nonPvReimbursed: 0,
      pvReimbursed: 0,
      explanation: 'Non-PV n\'ont pas atteint le seuil (< 10). Sabotage reste actif par défaut. Tous les jetons → AE.'
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

      {/* Corruption AE - Explication */}
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
            <div className="bg-[#0B0E14] rounded p-2 border-l-2 border-[#2AB3A6]">
              <span className="text-[#2AB3A6] font-medium">Non-PV paient ≥10 jetons</span>
              <span className="text-[#6B7280]"> → Annule le sabotage, Non-PV remboursés, jetons PV → AE</span>
            </div>
            <div className="bg-[#0B0E14] rounded p-2 border-l-2 border-[#B00020]">
              <span className="text-[#B00020] font-medium">PV paient ≥15 jetons (override)</span>
              <span className="text-[#6B7280]"> → Réactive le sabotage, Non-PV remboursés, jetons PV → AE</span>
            </div>
            <div className="bg-[#0B0E14] rounded p-2 border-l-2 border-[#6B7280]">
              <span className="text-[#9CA3AF] font-medium">Aucun seuil atteint</span>
              <span className="text-[#6B7280]"> → Sabotage reste actif, tous les jetons → AE</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Corruption simulator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Simulateur corruption</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setNonPvAmount(0); setPvAmount(0); }}
            className="text-[#9CA3AF] hover:text-white"
          >
            <RefreshCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-[#2AB3A6] font-medium block mb-2">Non-PV paient</label>
            <div className="flex flex-wrap gap-1">
              {[0, 5, 10, 15, 20].map(v => (
                <Button
                  key={v}
                  size="sm"
                  variant={nonPvAmount === v ? 'default' : 'outline'}
                  onClick={() => setNonPvAmount(v)}
                  className={nonPvAmount === v ? 'bg-[#2AB3A6] hover:bg-[#2AB3A6]/80' : 'border-[#2AB3A6]/30'}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#B00020] font-medium block mb-2">PV paient</label>
            <div className="flex flex-wrap gap-1">
              {[0, 5, 10, 15, 20].map(v => (
                <Button
                  key={v}
                  size="sm"
                  variant={pvAmount === v ? 'default' : 'outline'}
                  onClick={() => setPvAmount(v)}
                  className={pvAmount === v ? 'bg-[#B00020] hover:bg-[#B00020]/80' : 'border-[#B00020]/30'}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Résultats */}
        <div className="space-y-3">
          {/* Statut Sabotage / Arme BA */}
          <div className={`rounded-lg p-3 ${
            result.sabotageActive 
              ? 'bg-[#B00020]/20 border border-[#B00020]/50' 
              : 'bg-[#2AB3A6]/20 border border-[#2AB3A6]/50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className={`h-5 w-5 ${result.sabotageActive ? 'text-[#B00020]' : 'text-[#2AB3A6]'}`} />
                <span className="font-medium text-white">Arme du BA</span>
              </div>
              <span className={`font-bold text-lg ${result.sabotageActive ? 'text-[#B00020]' : 'text-[#2AB3A6]'}`}>
                {result.sabotageActive ? '🔴 SABOTÉE' : '🟢 FONCTIONNELLE'}
              </span>
            </div>
          </div>

          {/* Bonus AE */}
          <div className="bg-[#D4AF37]/20 border border-[#D4AF37]/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[#9CA3AF]">Bonus AE (PVic)</span>
              <span className="text-[#D4AF37] font-bold text-xl">+{result.aeBonus}</span>
            </div>
          </div>

          {/* Remboursements */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded p-2 text-center ${
              result.nonPvReimbursed > 0 
                ? 'bg-[#2AB3A6]/20 border border-[#2AB3A6]/40' 
                : 'bg-[#1a1a2e] border border-[#2D3748]'
            }`}>
              <p className="text-xs text-[#9CA3AF]">Non-PV remboursés</p>
              <p className={`font-bold ${result.nonPvReimbursed > 0 ? 'text-[#2AB3A6]' : 'text-[#6B7280]'}`}>
                {result.nonPvReimbursed > 0 ? `+${result.nonPvReimbursed}` : '0'}
              </p>
            </div>
            <div className={`rounded p-2 text-center ${
              result.pvReimbursed > 0 
                ? 'bg-[#B00020]/20 border border-[#B00020]/40' 
                : 'bg-[#1a1a2e] border border-[#2D3748]'
            }`}>
              <p className="text-xs text-[#9CA3AF]">PV remboursés</p>
              <p className={`font-bold ${result.pvReimbursed > 0 ? 'text-[#B00020]' : 'text-[#6B7280]'}`}>
                {result.pvReimbursed > 0 ? `+${result.pvReimbursed}` : '0'}
              </p>
            </div>
          </div>

          {/* Explication */}
          <div className="bg-[#0B0E14] rounded p-2">
            <p className="text-xs text-[#9CA3AF] italic">
              {result.explanation}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
