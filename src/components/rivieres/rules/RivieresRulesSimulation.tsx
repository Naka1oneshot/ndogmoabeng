import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Users, Coins, AlertTriangle, Ship, Anchor, Sparkles } from 'lucide-react';
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

const SCENARIOS = [
  { id: 'balanced', label: 'Équilibré', pot: 350, total: 8, restants: 4 },
  { id: 'all-stay', label: 'Tous restent', pot: 500, total: 10, restants: 10 },
  { id: 'few-stay', label: 'Peu restent', pot: 200, total: 8, restants: 2 },
];

export function RivieresRulesSimulation({ context, compact = false }: RivieresRulesSimulationProps) {
  const [pot, setPot] = useState(context.cagnotte || 300);
  const [totalPlayers, setTotalPlayers] = useState(context.totalPlayers || 8);
  const [restants, setRestants] = useState(context.playersEnBateau || 5);
  const [chavireToogle, setChavireToogle] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  
  // Computed values
  const descendus = totalPlayers - restants;
  const gainPerRestant = computePayoutPerPlayer(pot, restants);
  
  // Keep restants <= total
  useEffect(() => {
    if (restants > totalPlayers) {
      setRestants(totalPlayers);
    }
  }, [totalPlayers, restants]);
  
  // Trigger animation on change
  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [pot, totalPlayers, restants, chavireToogle]);
  
  const handleReset = () => {
    setPot(context.cagnotte || 300);
    setTotalPlayers(context.totalPlayers || 8);
    setRestants(context.playersEnBateau || 5);
    setChavireToogle(false);
  };
  
  const handleScenario = (scenario: typeof SCENARIOS[0]) => {
    setPot(scenario.pot);
    setTotalPlayers(scenario.total);
    setRestants(scenario.restants);
    setChavireToogle(false);
  };
  
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
            
            {/* Restants */}
            <div>
              <Label className="text-[#9CA3AF] text-sm mb-2 flex items-center justify-between">
                <span>Joueurs qui RESTENT</span>
                <span className="text-blue-400 font-bold">{restants}</span>
              </Label>
              <Slider
                value={[restants]}
                onValueChange={([v]) => setRestants(v)}
                min={0}
                max={totalPlayers}
                step={1}
                className="py-2"
              />
            </div>
            
            {/* Descendus (auto) */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#9CA3AF]">Joueurs qui DESCENDENT</span>
              <span className="text-amber-400 font-bold">{descendus}</span>
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
                onClick={() => handleScenario(SCENARIOS[0])}
                className="flex-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Exemple
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
              <p className="mb-2">
                En cas de chavirement, l'issue dépend des règles de la partie.
              </p>
              <p className="text-[#9CA3AF] text-xs">
                Généralement: ceux qui ont DESCENDU à ce niveau partagent la cagnotte, 
                ceux qui sont RESTÉS n'obtiennent rien.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF] text-sm">Restants</span>
                <span className="text-blue-400 font-bold">{restants} joueurs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF] text-sm">Descendus</span>
                <span className="text-amber-400 font-bold">{descendus} joueurs</span>
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
                  = floor({pot} / {restants || 1}) = {gainPerRestant}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Right: Visual & Scenarios */}
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
          
          {/* Players who stay */}
          {restants > 0 && !chavireToogle && (
            <div className="mb-4">
              <p className="text-blue-400 text-xs font-medium mb-2 flex items-center gap-1">
                <Ship className="h-3 w-3" /> RESTENT ({restants})
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Array.from({ length: Math.min(restants, 12) }).map((_, i) => (
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
                {restants > 12 && (
                  <span className="text-xs text-blue-400 self-center">+{restants - 12}</span>
                )}
              </div>
            </div>
          )}
          
          {/* Players who descend */}
          {descendus > 0 && (
            <div>
              <p className="text-amber-400 text-xs font-medium mb-2 flex items-center gap-1">
                <Anchor className="h-3 w-3" /> DESCENDENT ({descendus})
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {Array.from({ length: Math.min(descendus, 12) }).map((_, i) => (
                  <motion.div
                    key={`desc-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center opacity-60">
                      <Users className="h-4 w-4 text-amber-400" />
                    </div>
                    <span className="text-[10px] text-[#9CA3AF] mt-1">
                      {chavireToogle ? `+${computePayoutPerPlayer(pot, descendus)}` : '0'}
                    </span>
                  </motion.div>
                ))}
                {descendus > 12 && (
                  <span className="text-xs text-amber-400 self-center">+{descendus - 12}</span>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Scenarios */}
        <div className="bg-[#1a1f2e] rounded-xl p-4 border border-[#D4AF37]/20">
          <h3 className="text-[#D4AF37] font-bold mb-3 text-sm">Scénarios prédéfinis</h3>
          <div className="grid grid-cols-1 gap-2">
            {SCENARIOS.map(scenario => (
              <button
                key={scenario.id}
                onClick={() => handleScenario(scenario)}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0B1020] hover:bg-[#D4AF37]/10 transition-colors text-left"
              >
                <span className="text-[#E8E8E8] text-sm">{scenario.label}</span>
                <span className="text-xs text-[#9CA3AF]">
                  {scenario.pot} jetons - {scenario.restants}/{scenario.total}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <h4 className="text-blue-400 font-bold text-sm mb-2">Conseils stratégiques</h4>
          <ul className="text-xs text-[#E8E8E8] space-y-1">
            <li>• Plus il y a de restants, plus le gain individuel baisse</li>
            <li>• Descendre protège du risque mais supprime le gain de ce niveau</li>
            <li>• Au niveau 5, un bonus de 100 jetons attend les survivants</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
