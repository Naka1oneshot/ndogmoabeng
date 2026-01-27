import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Users, Coins, AlertTriangle, Ship, Anchor, Sparkles, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { RivieresRulesContextData, computePayoutPerPlayer } from './useRivieresRulesContext';

interface RivieresRulesSimulationProps {
  context: RivieresRulesContextData;
  compact?: boolean;
}

interface DescenduAtLevel {
  level: number;
  count: number;
}

export function RivieresRulesSimulation({ context, compact = false }: RivieresRulesSimulationProps) {
  const [pot, setPot] = useState(context.cagnotte || 300);
  const [totalPlayers, setTotalPlayers] = useState(context.totalPlayers || 8);
  const [level, setLevel] = useState(context.niveau || 5);
  const [chavireToogle, setChavireToogle] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  
  // Track descended players at each level (1 to level-1 for capsize, or 1 to 4 for level 5)
  const [descendusParNiveau, setDescendusParNiveau] = useState<number[]>([0, 0, 0, 0, 0]);
  
  // Computed values
  const maxDescendableLevel = chavireToogle ? level : 4;
  const totalDescendus = descendusParNiveau.slice(0, maxDescendableLevel).reduce((a, b) => a + b, 0);
  const restants = totalPlayers - totalDescendus;
  const isLevel5 = level === 5;
  
  // Level 5 success: restants share pot + 100 bonus each
  const gainPerRestant = isLevel5 && !chavireToogle ? computePayoutPerPlayer(pot, restants) + 100 : 0;
  
  // Capsize: each descendu gets their share + 10 × their descent level
  const computeDescenduGains = () => {
    if (!chavireToogle || totalDescendus === 0) return [];
    const potShare = computePayoutPerPlayer(pot, totalDescendus);
    const gains: { level: number; count: number; bonus: number; total: number }[] = [];
    
    for (let lvl = 1; lvl <= maxDescendableLevel; lvl++) {
      const count = descendusParNiveau[lvl - 1];
      if (count > 0) {
        const bonus = 10 * lvl;
        gains.push({ level: lvl, count, bonus, total: potShare + bonus });
      }
    }
    return gains;
  };
  
  const descenduGains = computeDescenduGains();
  
  // Keep descendus <= total
  useEffect(() => {
    const currentTotal = descendusParNiveau.reduce((a, b) => a + b, 0);
    if (currentTotal > totalPlayers) {
      // Reset descendus
      setDescendusParNiveau([0, 0, 0, 0, 0]);
    }
  }, [totalPlayers, descendusParNiveau]);
  
  // Trigger animation on change
  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [pot, totalPlayers, level, chavireToogle, descendusParNiveau]);
  
  const handleReset = () => {
    setPot(context.cagnotte || 300);
    setTotalPlayers(context.totalPlayers || 8);
    setLevel(context.niveau || 5);
    setChavireToogle(false);
    setDescendusParNiveau([0, 0, 0, 0, 0]);
  };
  
  const handleScenarioExample = () => {
    // Example from user: J1 descend lvl 1, J2 descend lvl 2, J3 descend lvl 3, capsize lvl 4
    setPot(90);
    setTotalPlayers(3);
    setLevel(4);
    setChavireToogle(true);
    setDescendusParNiveau([1, 1, 1, 0, 0]); // 1 at each level 1, 2, 3
  };
  
  const updateDescenduAtLevel = (lvl: number, value: number) => {
    const newDescendus = [...descendusParNiveau];
    newDescendus[lvl - 1] = value;
    // Ensure total doesn't exceed players
    const total = newDescendus.reduce((a, b) => a + b, 0);
    if (total <= totalPlayers) {
      setDescendusParNiveau(newDescendus);
    }
  };
  
  const remainingForDescente = totalPlayers - totalDescendus;
  
  return (
    <div className={`${compact ? 'space-y-4' : 'grid lg:grid-cols-2 gap-6'}`}>
      {/* Left: Parameters & Results */}
      <div className="space-y-4">
        {/* Parameters Card */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-[#D4AF37]/20">
          <h3 className="text-[#D4AF37] font-bold mb-4 flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Paramètres
          </h3>
          
          <div className="space-y-4">
            {/* Pot */}
            <div>
              <Label className="text-[#9CA3AF] text-sm mb-2 block">
                Cagnotte (pot)
              </Label>
              <NumberInput
                value={pot}
                onChange={setPot}
                min={0}
                max={10000}
                className="bg-[#0B1020] border-[#D4AF37]/30 text-white"
              />
            </div>
            
            {/* Total players */}
            <div>
              <Label className="text-[#9CA3AF] text-sm mb-2 flex items-center justify-between">
                <span>Joueurs total</span>
                <span className="text-white font-bold">{totalPlayers}</span>
              </Label>
              <Slider
                value={[totalPlayers]}
                onValueChange={([v]) => setTotalPlayers(v)}
                min={1}
                max={30}
                step={1}
                className="py-2"
              />
            </div>
            
            {/* Level selector */}
            <div className="pt-2 border-t border-white/10">
              <Label className="text-[#9CA3AF] text-sm mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#D4AF37]" />
                  {chavireToogle ? 'Niveau du chavirement' : 'Niveau actuel'}
                </span>
                <span className="text-[#D4AF37] font-bold">{level}</span>
              </Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                      level === lvl
                        ? 'bg-[#D4AF37] text-black'
                        : 'bg-[#0B1020] text-[#9CA3AF] hover:bg-[#D4AF37]/20'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Chavire toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <Label className="text-[#9CA3AF] text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                Bateau chavire ?
              </Label>
              <Switch
                checked={chavireToogle}
                onCheckedChange={setChavireToogle}
              />
            </div>
            
            {/* Descendus per level */}
            <div className="pt-2 border-t border-white/10">
              <Label className="text-[#9CA3AF] text-sm mb-3 flex items-center gap-2">
                <Anchor className="h-4 w-4 text-amber-400" />
                Descendus par niveau (restants: {remainingForDescente})
              </Label>
              <div className="space-y-2">
                {Array.from({ length: maxDescendableLevel }).map((_, i) => {
                  const lvl = i + 1;
                  const maxForThisLevel = remainingForDescente + descendusParNiveau[i];
                  return (
                    <div key={lvl} className="flex items-center gap-3">
                      <span className="text-amber-400 font-bold text-sm w-16">Niv. {lvl}</span>
                      <Slider
                        value={[descendusParNiveau[i]]}
                        onValueChange={([v]) => updateDescenduAtLevel(lvl, v)}
                        min={0}
                        max={Math.min(maxForThisLevel, totalPlayers)}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-amber-400 font-bold text-sm w-8 text-right">
                        {descendusParNiveau[i]}
                      </span>
                      <span className="text-[#9CA3AF] text-xs w-16">
                        (+{10 * lvl})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Restants (auto) */}
            <div className="flex items-center justify-between text-sm pt-2">
              <span className="text-[#9CA3AF] flex items-center gap-2">
                <Ship className="h-4 w-4 text-blue-400" />
                Joueurs qui RESTENT
              </span>
              <span className="text-blue-400 font-bold">{restants}</span>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {!context.isDemo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="flex-1 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Valeurs partie
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleScenarioExample}
                className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Exemple (J1+J2+J3)
              </Button>
            </div>
          </div>
        </div>
        
        {/* Results Card */}
        <div className={`rounded-xl p-4 border ${
          chavireToogle 
            ? 'bg-red-500/10 border-red-500/30' 
            : 'bg-green-500/10 border-green-500/30'
        }`}>
          <h3 className={`font-bold mb-3 flex items-center gap-2 ${
            chavireToogle ? 'text-red-400' : 'text-green-400'
          }`}>
            {chavireToogle ? <AlertTriangle className="h-4 w-4" /> : <Anchor className="h-4 w-4" />}
            {chavireToogle ? 'Chavirement !' : 'Résultat'}
          </h3>
          
          {chavireToogle ? (
            <div className="text-[#E8E8E8] text-sm">
              <p className="mb-3 font-medium text-red-400">
                Le bateau a chaviré au niveau {level} ! Les descendus partagent la cagnotte + bonus individuel.
              </p>
              
              {totalDescendus > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9CA3AF]">Part cagnotte par descendu</span>
                    <span className="text-[#D4AF37] font-bold">
                      floor({pot} / {totalDescendus}) = {computePayoutPerPlayer(pot, totalDescendus)}
                    </span>
                  </div>
                  
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-amber-400 font-medium mb-2">Gains par joueur :</p>
                    {descenduGains.map(({ level: lvl, count, bonus, total }) => (
                      <motion.div
                        key={lvl}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between mb-1"
                      >
                        <span className="text-[#9CA3AF] text-sm">
                          {count}× Descendu niv.{lvl}
                        </span>
                        <span className="text-[#D4AF37] font-bold">
                          {computePayoutPerPlayer(pot, totalDescendus)} + {bonus} = <span className="text-lg">{total}</span>
                        </span>
                      </motion.div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-[#9CA3AF]">Restants (chavirés)</span>
                    <span className="text-red-400 font-bold">0 jetons</span>
                  </div>
                </div>
              ) : (
                <p className="text-[#9CA3AF] italic">Aucun descendu configuré</p>
              )}
            </div>
          ) : isLevel5 ? (
            <div className="space-y-3">
              <p className="text-green-400 text-sm font-medium">
                Niveau 5 réussi ! Les restants partagent la cagnotte + bonus.
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF] text-sm">Restants</span>
                <span className="text-blue-400 font-bold">{restants} joueurs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF] text-sm">Descendus</span>
                <span className="text-amber-400 font-bold">{totalDescendus} joueurs → 0 jetons</span>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] text-sm">Gain par restant</span>
                  <motion.span
                    key={animKey}
                    initial={{ scale: 1.5, color: '#22c55e' }}
                    animate={{ scale: 1, color: '#D4AF37' }}
                    className="text-xl font-bold"
                  >
                    {gainPerRestant} jetons
                  </motion.span>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  = floor({pot} / {restants || 1}) + 100 = {computePayoutPerPlayer(pot, restants)} + 100
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-500/20 rounded-lg p-3 text-center">
                <p className="text-amber-400 font-medium text-sm">
                  Niveau {level} réussi — Pas de distribution
                </p>
                <p className="text-[#9CA3AF] text-xs mt-1">
                  La cagnotte s'accumule pour le niveau suivant
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF] text-sm">Cagnotte conservée</span>
                <span className="text-[#D4AF37] font-bold">{pot} jetons</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF] text-sm">Restants → prochain niveau</span>
                <span className="text-blue-400 font-bold">{restants} joueurs</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Right: Visual & Tips */}
      <div className="space-y-4">
        {/* Visual distribution */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-[#D4AF37]/20">
          <h3 className="text-[#D4AF37] font-bold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Distribution visuelle
          </h3>
          
          {/* Pot */}
          <div className="flex justify-center mb-4">
            <motion.div
              key={`pot-${animKey}`}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37] flex items-center justify-center"
            >
              <div className="text-center">
                <Coins className="h-6 w-6 text-[#D4AF37] mx-auto" />
                <span className="text-[#D4AF37] font-bold text-sm">{pot}</span>
              </div>
            </motion.div>
          </div>
          
          {/* Players who stay - Level 5 success */}
          {restants > 0 && !chavireToogle && isLevel5 && (
            <div className="mb-4">
              <p className="text-blue-400 text-xs font-medium mb-2 flex items-center gap-1">
                <Ship className="h-3 w-3" /> RESTENT ({restants}) - Niveau 5 réussi
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Array.from({ length: Math.min(restants, 8) }).map((_, i) => (
                  <motion.div
                    key={`stay-${i}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
                      <Users className="h-4 w-4 text-blue-400" />
                    </div>
                    <motion.span
                      key={`gain-${animKey}-${i}`}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="text-[10px] text-[#D4AF37] font-bold mt-1"
                    >
                      +{gainPerRestant}
                    </motion.span>
                  </motion.div>
                ))}
                {restants > 8 && (
                  <span className="text-xs text-blue-400 self-center">+{restants - 8}</span>
                )}
              </div>
            </div>
          )}
          
          {/* Players who stay - no distribution (level 1-4) */}
          {restants > 0 && !chavireToogle && !isLevel5 && (
            <div className="mb-4">
              <p className="text-blue-400 text-xs font-medium mb-2 flex items-center gap-1">
                <Ship className="h-3 w-3" /> RESTENT ({restants}) - Niveau {level} (pas de distribution)
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Array.from({ length: Math.min(restants, 8) }).map((_, i) => (
                  <motion.div
                    key={`stay-${i}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center opacity-60">
                      <Users className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-[10px] text-[#9CA3AF] mt-1">→</span>
                  </motion.div>
                ))}
                {restants > 8 && (
                  <span className="text-xs text-blue-400 self-center">+{restants - 8}</span>
                )}
              </div>
            </div>
          )}
          
          {/* Players who descended - grouped by level */}
          {totalDescendus > 0 && (
            <div>
              <p className="text-amber-400 text-xs font-medium mb-2 flex items-center gap-1">
                <Anchor className="h-3 w-3" /> DESCENDUS ({totalDescendus})
                {chavireToogle && ' - Partagent la cagnotte'}
              </p>
              <div className="space-y-2">
                {descendusParNiveau.map((count, i) => {
                  if (count === 0 || i >= maxDescendableLevel) return null;
                  const lvl = i + 1;
                  const bonus = 10 * lvl;
                  const total = chavireToogle ? computePayoutPerPlayer(pot, totalDescendus) + bonus : 0;
                  
                  return (
                    <div key={lvl} className="flex items-center gap-2">
                      <span className="text-amber-400 text-xs w-12">Niv.{lvl}</span>
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(count, 5) }).map((_, j) => (
                          <motion.div
                            key={j}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center"
                          >
                            <Users className="h-3 w-3 text-amber-400" />
                          </motion.div>
                        ))}
                        {count > 5 && <span className="text-xs text-amber-400">+{count - 5}</span>}
                      </div>
                      <span className={`text-xs ml-auto ${chavireToogle ? 'text-[#D4AF37] font-bold' : 'text-[#9CA3AF]'}`}>
                        {chavireToogle ? `+${total}` : '0'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <h4 className="text-blue-400 font-bold text-sm mb-2">Règles de distribution</h4>
          <ul className="text-xs text-[#E8E8E8] space-y-1">
            <li>• <strong>Niveaux 1-4 :</strong> la cagnotte s'accumule, pas de distribution</li>
            <li>• <strong>Niveau 5 :</strong> les restants partagent la cagnotte + 100 chacun</li>
            <li>• <strong>Chavirement :</strong> les descendus partagent la cagnotte + <span className="text-amber-400">10 × leur niveau de descente</span></li>
          </ul>
        </div>
        
        {/* Example scenario */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <h4 className="text-amber-400 font-bold text-sm mb-2">Exemple détaillé</h4>
          <p className="text-xs text-[#E8E8E8]">
            J1 descend niveau 1, J2 descend niveau 2, J3 descend niveau 3.<br/>
            Chavirement au niveau 4 avec 90 jetons en cagnotte :
          </p>
          <ul className="text-xs text-[#E8E8E8] mt-2 space-y-1">
            <li>• J1 : floor(90/3) + 10 = 30 + 10 = <span className="text-[#D4AF37] font-bold">40 jetons</span></li>
            <li>• J2 : floor(90/3) + 20 = 30 + 20 = <span className="text-[#D4AF37] font-bold">50 jetons</span></li>
            <li>• J3 : floor(90/3) + 30 = 30 + 30 = <span className="text-[#D4AF37] font-bold">60 jetons</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
