import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHERIFF_COLORS } from '../SheriffTheme';

interface PlayerChoice {
  id: string;
  player_number: number;
  visa_choice: string | null;
  visa_cost_applied: number;
  tokens_entering: number | null;
  has_illegal_tokens: boolean;
  victory_points_delta: number;
  pvic_initial?: number;
}

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  pvic: number | null;
  is_bot?: boolean;
}

interface SheriffVisaCostsSummaryAnimationProps {
  players: Player[];
  choices: PlayerChoice[];
  poolInitial: number;
  poolSpent: number;
  visaPvicPercent: number;
  poolCostPerPlayer: number;
  onComplete: () => void;
}

export function SheriffVisaCostsSummaryAnimation({
  players,
  choices,
  poolInitial,
  poolSpent,
  visaPvicPercent,
  poolCostPerPlayer,
  onComplete,
}: SheriffVisaCostsSummaryAnimationProps) {
  const [phase, setPhase] = useState<'intro' | 'pvic_players' | 'pool_players' | 'totals' | 'done'>('intro');
  const [visiblePvicIndex, setVisiblePvicIndex] = useState(0);
  const [visiblePoolIndex, setVisiblePoolIndex] = useState(0);
  const [showTotals, setShowTotals] = useState(false);
  
  const pvicPlayers = choices.filter(c => c.visa_choice === 'VICTORY_POINTS');
  const poolPlayers = choices.filter(c => c.visa_choice === 'COMMON_POOL');
  
  const getPlayer = (num: number) => players.find(p => p.player_number === num);
  
  const totalPvicCost = pvicPlayers.reduce((sum, c) => sum + c.visa_cost_applied, 0);
  const totalPoolCost = poolPlayers.reduce((sum, c) => sum + c.visa_cost_applied, 0);
  
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Phase transitions
    timers.push(setTimeout(() => setPhase('pvic_players'), 1500));
    
    // Reveal PVic players one by one
    pvicPlayers.forEach((_, i) => {
      timers.push(setTimeout(() => setVisiblePvicIndex(i + 1), 1800 + i * 400));
    });
    
    // Move to pool players
    const poolStartDelay = 1800 + pvicPlayers.length * 400 + 800;
    timers.push(setTimeout(() => setPhase('pool_players'), poolStartDelay));
    
    // Reveal pool players one by one
    poolPlayers.forEach((_, i) => {
      timers.push(setTimeout(() => setVisiblePoolIndex(i + 1), poolStartDelay + 300 + i * 400));
    });
    
    // Show totals
    const totalsDelay = poolStartDelay + 300 + poolPlayers.length * 400 + 800;
    timers.push(setTimeout(() => {
      setPhase('totals');
      setShowTotals(true);
    }, totalsDelay));
    
    // Complete
    timers.push(setTimeout(() => {
      setPhase('done');
      onComplete();
    }, totalsDelay + 2500));
    
    return () => timers.forEach(clearTimeout);
  }, [pvicPlayers.length, poolPlayers.length, onComplete]);
  
  return (
    <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center">
      <div className="max-w-4xl w-full px-4">
        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-center mb-8"
          style={{ color: SHERIFF_COLORS.primary }}
        >
          📜 Récapitulatif des Coûts Visa
        </motion.h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PVic Payments Column */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: phase !== 'intro' ? 1 : 0, x: phase !== 'intro' ? 0 : -50 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border-2 border-purple-500/50 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⭐</span>
              <h3 className="text-lg font-bold text-purple-300">Paiement en PVic</h3>
              <span className="ml-auto text-sm text-purple-400">-{visaPvicPercent}% PV</span>
            </div>
            
            <div className="space-y-2 min-h-[120px]">
              <AnimatePresence>
                {pvicPlayers.slice(0, visiblePvicIndex).map((choice, idx) => {
                  const player = getPlayer(choice.player_number);
                  return (
                    <motion.div
                      key={choice.id}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between bg-purple-950/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-purple-100 text-sm truncate max-w-[150px]">
                        {player?.is_bot && '🤖 '}{player?.display_name || `J${choice.player_number}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-bold text-sm">
                          -{choice.visa_cost_applied} PV
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {pvicPlayers.length === 0 && phase !== 'intro' && (
                <div className="text-purple-400/50 text-center text-sm py-4">
                  Aucun joueur
                </div>
              )}
            </div>
            
            {/* PVic Total */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showTotals ? 1 : 0 }}
              className="mt-4 pt-3 border-t border-purple-500/30"
            >
              <div className="flex justify-between items-center">
                <span className="text-purple-300 font-medium">Total PVic perdus</span>
                <span className="text-xl font-bold text-red-400">-{totalPvicCost} PV</span>
              </div>
            </motion.div>
          </motion.div>
          
          {/* Pool Payments Column */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: phase === 'pool_players' || phase === 'totals' ? 1 : 0, x: phase === 'pool_players' || phase === 'totals' ? 0 : 50 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 border-2 border-amber-500/50 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">💰</span>
              <h3 className="text-lg font-bold text-amber-300">Paiement Cagnotte</h3>
              <span className="ml-auto text-sm text-amber-400">{poolCostPerPlayer}€/joueur</span>
            </div>
            
            <div className="space-y-2 min-h-[120px]">
              <AnimatePresence>
                {poolPlayers.slice(0, visiblePoolIndex).map((choice, idx) => {
                  const player = getPlayer(choice.player_number);
                  return (
                    <motion.div
                      key={choice.id}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between bg-amber-950/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-amber-100 text-sm truncate max-w-[150px]">
                        {player?.is_bot && '🤖 '}{player?.display_name || `J${choice.player_number}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-bold text-sm">
                          -{choice.visa_cost_applied}€
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {poolPlayers.length === 0 && (phase === 'pool_players' || phase === 'totals') && (
                <div className="text-amber-400/50 text-center text-sm py-4">
                  Aucun joueur
                </div>
              )}
            </div>
            
            {/* Pool Total */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showTotals ? 1 : 0 }}
              className="mt-4 pt-3 border-t border-amber-500/30"
            >
              <div className="flex justify-between items-center">
                <span className="text-amber-300 font-medium">Total prélevé</span>
                <span className="text-xl font-bold text-amber-400">-{totalPoolCost}€</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Global Summary */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ 
            opacity: showTotals ? 1 : 0, 
            y: showTotals ? 0 : 30,
            scale: showTotals ? 1 : 0.95 
          }}
          transition={{ duration: 0.5 }}
          className="mt-8 bg-gradient-to-r from-[#2A2215] to-[#1A1510] border-2 border-[#D4AF37]/50 rounded-2xl p-6"
        >
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <div className="text-sm text-[#9CA3AF] mb-1">Cagnotte Restante</div>
              <div className="text-3xl font-bold" style={{ color: SHERIFF_COLORS.primary }}>
                {poolInitial - poolSpent}€
              </div>
              <div className="text-xs text-[#9CA3AF] mt-1">
                sur {poolInitial}€ initial
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-[#9CA3AF] mb-1">Joueurs Prêts</div>
              <div className="text-3xl font-bold text-green-400">
                {choices.filter(c => c.visa_choice).length}
              </div>
              <div className="text-xs text-[#9CA3AF] mt-1">
                passent aux duels
              </div>
            </div>
          </div>
          
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: showTotals ? '100%' : 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="h-1 bg-gradient-to-r from-purple-500 via-[#D4AF37] to-amber-500 rounded-full mt-4"
          />
        </motion.div>
      </div>
    </div>
  );
}
