import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Users, Shuffle, Target, ArrowRight, Sparkles, Shield, Skull } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { computeFinalPositions, getAttackOrder } from '@/lib/forestPriority';
import { ForetRulesContextData } from './useForetRulesContext';

interface ForetSimulationSectionProps {
  context: ForetRulesContextData;
  replayNonce: number;
}

interface PlayerConfig {
  num: number;
  priority: number; // 1 = highest priority
  desiredPosition: number;
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

export function ForetSimulationSection({ context, replayNonce }: ForetSimulationSectionProps) {
  const [playerCount, setPlayerCount] = useState(3);
  const [players, setPlayers] = useState<PlayerConfig[]>([]);
  const [finalPositions, setFinalPositions] = useState<Record<number, number>>({});
  const [animKey, setAnimKey] = useState(0);

  // Initialize players when count changes
  useEffect(() => {
    const newPlayers: PlayerConfig[] = [];
    for (let i = 1; i <= playerCount; i++) {
      newPlayers.push({
        num: i,
        priority: i, // Default: J1 has lowest priority (N), JN has highest (1)
        desiredPosition: 2, // All want position 2 by default
      });
    }
    // Reverse priority so J3 > J2 > J1 (J3 has priority 1)
    newPlayers.forEach((p, idx) => {
      p.priority = playerCount - idx;
    });
    setPlayers(newPlayers);
  }, [playerCount]);

  // Recalculate positions when players change
  useEffect(() => {
    if (players.length === 0) return;

    const priorityOrder = [...players]
      .sort((a, b) => a.priority - b.priority)
      .map(p => p.num);

    const desiredMap: Record<number, number> = {};
    players.forEach(p => {
      desiredMap[p.num] = p.desiredPosition;
    });

    const result = computeFinalPositions(priorityOrder, desiredMap, playerCount);
    setFinalPositions(result);
    setAnimKey(k => k + 1);
  }, [players, playerCount]);

  const updatePlayerPriority = (playerNum: number, newPriority: number) => {
    setPlayers(prev => {
      // Swap priorities
      const currentPlayer = prev.find(p => p.num === playerNum);
      const playerWithPriority = prev.find(p => p.priority === newPriority);
      
      if (!currentPlayer || !playerWithPriority) return prev;
      
      return prev.map(p => {
        if (p.num === playerNum) return { ...p, priority: newPriority };
        if (p.num === playerWithPriority.num) return { ...p, priority: currentPlayer.priority };
        return p;
      });
    });
  };

  const updateDesiredPosition = (playerNum: number, position: number) => {
    setPlayers(prev => prev.map(p => 
      p.num === playerNum ? { ...p, desiredPosition: position } : p
    ));
  };

  const handleCanonExample = () => {
    // Canon example: J3>J2>J1, all want position 2
    setPlayerCount(3);
    setPlayers([
      { num: 1, priority: 3, desiredPosition: 2 },
      { num: 2, priority: 2, desiredPosition: 2 },
      { num: 3, priority: 1, desiredPosition: 2 },
    ]);
  };

  const handleReset = () => {
    const newPlayers: PlayerConfig[] = [];
    for (let i = 1; i <= playerCount; i++) {
      newPlayers.push({
        num: i,
        priority: playerCount - i + 1,
        desiredPosition: 2,
      });
    }
    setPlayers(newPlayers);
  };

  const attackOrder = getAttackOrder(finalPositions);

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
          Simulation — Positions finales
        </h1>
        <p className="text-[#9CA3AF]">
          Testez l'algorithme d'attribution des positions
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Parameters */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-[#1a1f2e] rounded-xl p-4 border border-emerald-500/20">
            <h3 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Configuration
            </h3>

            {/* Player count */}
            <div className="mb-4">
              <Label className="text-[#9CA3AF] text-sm mb-2 flex items-center justify-between">
                <span>Nombre de joueurs</span>
                <span className="text-white font-bold">{playerCount}</span>
              </Label>
              <Slider
                value={[playerCount]}
                onValueChange={([v]) => setPlayerCount(v)}
                min={2}
                max={8}
                step={1}
                className="py-2"
              />
            </div>

            {/* Priority & Desired positions */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <Label className="text-[#9CA3AF] text-sm flex items-center gap-2">
                <Shuffle className="h-4 w-4 text-emerald-400" />
                Priorité & Position souhaitée
              </Label>
              
              <div className="space-y-2">
                {players.sort((a, b) => a.num - b.num).map(player => (
                  <div key={player.num} className="flex items-center gap-3 bg-[#0B1020] rounded-lg p-2">
                    <span className="text-white font-bold text-sm w-8">J{player.num}</span>
                    
                    <div className="flex-1">
                      <Label className="text-[#6B7280] text-xs">Priorité</Label>
                      <div className="flex gap-1">
                        {Array.from({ length: playerCount }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => updatePlayerPriority(player.num, p)}
                            className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                              player.priority === p
                                ? 'bg-emerald-500 text-black'
                                : 'bg-[#1a1f2e] text-[#6B7280] hover:bg-emerald-500/20'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="w-24">
                      <Label className="text-[#6B7280] text-xs">Pos. souhaitée</Label>
                      <div className="flex gap-1">
                        {Array.from({ length: playerCount }, (_, i) => i + 1).map(pos => (
                          <button
                            key={pos}
                            onClick={() => updateDesiredPosition(player.num, pos)}
                            className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                              player.desiredPosition === pos
                                ? 'bg-amber-500 text-black'
                                : 'bg-[#1a1f2e] text-[#6B7280] hover:bg-amber-500/20'
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="flex-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Réinitialiser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCanonExample}
                className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Exemple canon
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Right: Results */}
        <motion.div variants={itemVariants} className="space-y-4">
          {/* Priority order display */}
          <div className="bg-[#1a1f2e] rounded-xl p-4 border border-emerald-500/20">
            <h3 className="text-emerald-400 font-bold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Ordre de priorité
            </h3>
            <div className="flex flex-wrap gap-2">
              {[...players]
                .sort((a, b) => a.priority - b.priority)
                .map((player, idx) => (
                  <motion.div
                    key={player.num}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-center gap-1"
                  >
                    <span className={`px-3 py-1.5 rounded-lg font-bold text-sm ${
                      idx === 0 ? 'bg-emerald-500 text-black' : 'bg-[#0B1020] text-white'
                    }`}>
                      J{player.num}
                    </span>
                    {idx < players.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-[#6B7280]" />
                    )}
                  </motion.div>
                ))}
            </div>
          </div>

          {/* Final positions */}
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-400" />
              Positions finales attribuées
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {players.sort((a, b) => a.num - b.num).map(player => {
                const finalPos = finalPositions[player.num] || 1;
                const gotDesired = finalPos === player.desiredPosition;
                
                return (
                  <motion.div
                    key={`${animKey}-${player.num}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg text-center ${
                      gotDesired ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                    }`}
                  >
                    <div className="text-white font-bold text-lg">J{player.num}</div>
                    <div className={`text-2xl font-black ${gotDesired ? 'text-emerald-400' : 'text-amber-400'}`}>
                      Pos {finalPos}
                    </div>
                    <div className="text-[#9CA3AF] text-xs mt-1">
                      {gotDesired ? '✓ Souhaité' : `Souhaité: ${player.desiredPosition}`}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Attack order */}
          <div className="bg-[#1a1f2e] rounded-xl p-4 border border-red-500/20">
            <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
              <Skull className="h-4 w-4" />
              Ordre d'attaque résultant
            </h3>
            <div className="flex flex-wrap gap-2">
              {attackOrder.map((playerNum, idx) => (
                <motion.div
                  key={`attack-${animKey}-${playerNum}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-1"
                >
                  <span className="bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-lg font-bold text-sm text-red-400">
                    {idx + 1}. J{playerNum}
                  </span>
                  {idx < attackOrder.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-[#6B7280]" />
                  )}
                </motion.div>
              ))}
            </div>
            <p className="text-[#9CA3AF] text-xs mt-2">
              Position 1 attaque en premier, puis position 2, etc.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Explanation */}
      <motion.div
        variants={itemVariants}
        className="bg-[#0B1020] border border-emerald-500/20 rounded-lg p-4"
      >
        <h4 className="text-emerald-400 font-bold mb-2">Algorithme d'attribution (wrap-around)</h4>
        <ol className="text-[#9CA3AF] text-sm space-y-1 list-decimal list-inside">
          <li>Les joueurs sont traités par ordre de priorité (priorité 1 en premier)</li>
          <li>Chaque joueur obtient sa position souhaitée si elle est libre</li>
          <li>Si occupée → essayer position +1 (wrap à 1 après la dernière)</li>
          <li>Continuer jusqu'à trouver une place libre</li>
        </ol>
      </motion.div>
    </motion.div>
  );
}
