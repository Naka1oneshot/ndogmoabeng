import { useState } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, Coins, Swords, Search, ArrowRight, 
  RotateCcw, Users, AlertTriangle 
} from 'lucide-react';
import { 
  SheriffRulesContextData, 
  computePoolSpentWithFloor,
  computeIllegalTokens,
  computeDuelOutcome
} from './useSheriffRulesContext';

interface SheriffSimulationSectionProps {
  context: SheriffRulesContextData;
}

export function SheriffSimulationSection({ context }: SheriffSimulationSectionProps) {
  // Visa simulation
  const [simPlayers, setSimPlayers] = useState(8);
  const [simPoolChoicers, setSimPoolChoicers] = useState(3);
  const [simPoolInitial, setSimPoolInitial] = useState(context.poolInitial || 100);
  
  // Tokens simulation
  const [simTokens, setSimTokens] = useState(25);
  
  // Duel simulation
  const [playerTokens, setPlayerTokens] = useState(25);
  const [opponentTokens, setOpponentTokens] = useState(20);
  const [playerSearches, setPlayerSearches] = useState(false);
  const [opponentSearches, setOpponentSearches] = useState(false);
  
  // Final duel simulation
  const [finalDuelPlayers, setFinalDuelPlayers] = useState([
    { num: 1, pvicInit: 100, pvicCurrent: 85 },
    { num: 2, pvicInit: 100, pvicCurrent: 120 },
    { num: 3, pvicInit: 100, pvicCurrent: 60 },
    { num: 4, pvicInit: 100, pvicCurrent: 95 },
  ]);

  // Compute simulations
  const poolResult = computePoolSpentWithFloor(
    simPoolChoicers,
    context.costPerPlayer,
    simPoolInitial,
    context.floorPercent
  );

  const illegalCount = computeIllegalTokens(simTokens);
  
  const duelResult = computeDuelOutcome(
    playerSearches,
    opponentSearches,
    computeIllegalTokens(playerTokens),
    computeIllegalTokens(opponentTokens),
    {
      gainPerIllegalFound: context.gainPerIllegalFound,
      lossSearchNoIllegal: context.lossSearchNoIllegal,
      gainPerIllegalPassed: context.gainPerIllegalPassed,
      lossPerIllegalCaught: context.lossPerIllegalCaught,
    }
  );

  // Find biggest PVic loser (for final duel)
  const findBiggestLoser = () => {
    let loser = finalDuelPlayers[0];
    let minDelta = loser.pvicCurrent - loser.pvicInit;
    
    for (const p of finalDuelPlayers) {
      const delta = p.pvicCurrent - p.pvicInit;
      if (delta < minDelta || (delta === minDelta && p.num < loser.num)) {
        loser = p;
        minDelta = delta;
      }
    }
    return { loser, delta: minDelta };
  };

  const resetDuelSim = () => {
    setPlayerTokens(25);
    setOpponentTokens(20);
    setPlayerSearches(false);
    setOpponentSearches(false);
  };

  return (
    <div className="space-y-8">
      {/* VISA Simulation */}
      <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Simulation Visa & Cagnotte
        </h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">
              Cagnotte initiale: {simPoolInitial}€
            </label>
            <Slider
              value={[simPoolInitial]}
              onValueChange={([v]) => setSimPoolInitial(v)}
              min={50}
              max={200}
              step={10}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-xs text-[#9CA3AF] block mb-1">
              Joueurs choisissant cagnotte: {simPoolChoicers}/{simPlayers}
            </label>
            <Slider
              value={[simPoolChoicers]}
              onValueChange={([v]) => setSimPoolChoicers(v)}
              min={0}
              max={simPlayers}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        <div className="bg-[#1A1510] rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#9CA3AF]">Coût brut:</span>
            <span className="text-[#E8E8E8]">{simPoolChoicers} × {context.costPerPlayer}€ = {simPoolChoicers * context.costPerPlayer}€</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9CA3AF]">Floor ({context.floorPercent}%):</span>
            <span className="text-[#E8E8E8]">{Math.round(simPoolInitial * context.floorPercent / 100)}€</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#9CA3AF]">Dépense effective:</span>
            <span className={poolResult.capped ? 'text-[#F59E0B]' : 'text-[#E8E8E8]'}>
              {poolResult.spent}€ {poolResult.capped && '(plafonné)'}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span className="text-[#D4AF37]">Cagnotte restante:</span>
            <span className="text-[#4ADE80]">{poolResult.poolRemaining}€</span>
          </div>
        </div>
      </div>

      {/* TOKENS Simulation */}
      <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Simulation Jetons
        </h3>
        
        <div>
          <label className="text-xs text-[#9CA3AF] block mb-1">
            Jetons entrants: {simTokens}
          </label>
          <Slider
            value={[simTokens]}
            onValueChange={([v]) => setSimTokens(v)}
            min={20}
            max={30}
            step={1}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-4">
          <Badge className={simTokens <= 20 ? 'bg-[#4ADE80]/20 text-[#4ADE80]' : 'bg-[#EF4444]/20 text-[#EF4444]'}>
            {simTokens <= 20 ? '✓ Légal' : `⚠️ ${illegalCount} illégaux`}
          </Badge>
          {illegalCount > 0 && (
            <span className="text-xs text-[#9CA3AF]">
              Si passé: +{illegalCount * context.gainPerIllegalPassed}% PVic
            </span>
          )}
        </div>
      </div>

      {/* DUEL Simulation */}
      <div className="bg-[#2A2215] border border-[#D4AF37]/20 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[#D4AF37] flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Simulation Duel
          </h3>
          <Button variant="ghost" size="sm" onClick={resetDuelSim} className="text-[#9CA3AF]">
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Player A */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-[#E8E8E8]">👤 Vous</h4>
            <div>
              <label className="text-xs text-[#9CA3AF]">Jetons: {playerTokens}</label>
              <Slider
                value={[playerTokens]}
                onValueChange={([v]) => setPlayerTokens(v)}
                min={20}
                max={30}
                step={1}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={playerSearches ? 'default' : 'outline'}
                onClick={() => setPlayerSearches(true)}
                className={playerSearches ? 'bg-[#F59E0B] text-white' : ''}
              >
                <Search className="h-4 w-4 mr-1" /> Fouiller
              </Button>
              <Button
                size="sm"
                variant={!playerSearches ? 'default' : 'outline'}
                onClick={() => setPlayerSearches(false)}
                className={!playerSearches ? 'bg-[#4ADE80] text-white' : ''}
              >
                <ArrowRight className="h-4 w-4 mr-1" /> Passer
              </Button>
            </div>
          </div>

          {/* Opponent */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-[#E8E8E8]">🎭 Adversaire</h4>
            <div>
              <label className="text-xs text-[#9CA3AF]">Jetons: {opponentTokens}</label>
              <Slider
                value={[opponentTokens]}
                onValueChange={([v]) => setOpponentTokens(v)}
                min={20}
                max={30}
                step={1}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={opponentSearches ? 'default' : 'outline'}
                onClick={() => setOpponentSearches(true)}
                className={opponentSearches ? 'bg-[#F59E0B] text-white' : ''}
              >
                <Search className="h-4 w-4 mr-1" /> Fouiller
              </Button>
              <Button
                size="sm"
                variant={!opponentSearches ? 'default' : 'outline'}
                onClick={() => setOpponentSearches(false)}
                className={!opponentSearches ? 'bg-[#4ADE80] text-white' : ''}
              >
                <ArrowRight className="h-4 w-4 mr-1" /> Passer
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-[#1A1510] rounded-lg p-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-xs text-[#9CA3AF]">Votre résultat</span>
            <div className={`text-lg font-bold ${duelResult.playerDelta >= 0 ? 'text-[#4ADE80]' : 'text-[#EF4444]'}`}>
              {duelResult.playerDelta > 0 ? '+' : ''}{duelResult.playerDelta}% PVic
            </div>
            {duelResult.playerTokensLost > 0 && (
              <Badge className="bg-[#EF4444]/20 text-[#EF4444]">-{duelResult.playerTokensLost} jetons</Badge>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-xs text-[#9CA3AF]">Adversaire</span>
            <div className={`text-lg font-bold ${duelResult.opponentDelta >= 0 ? 'text-[#4ADE80]' : 'text-[#EF4444]'}`}>
              {duelResult.opponentDelta > 0 ? '+' : ''}{duelResult.opponentDelta}% PVic
            </div>
            {duelResult.opponentTokensLost > 0 && (
              <Badge className="bg-[#EF4444]/20 text-[#EF4444]">-{duelResult.opponentTokensLost} jetons</Badge>
            )}
          </div>
        </div>
      </div>

      {/* FINAL DUEL Simulation */}
      <div className="bg-[#2A2215] border border-[#F59E0B]/30 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-[#F59E0B] flex items-center gap-2">
          <Users className="h-5 w-5" />
          Simulation Dernier Duel
        </h3>
        
        <p className="text-xs text-[#9CA3AF]">
          Modifiez les PVic actuels pour voir qui serait sélectionné comme challenger
        </p>

        <div className="grid gap-2 sm:grid-cols-2">
          {finalDuelPlayers.map((p, i) => (
            <div key={p.num} className="bg-[#1A1510] rounded-lg p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#E8E8E8]">Joueur #{p.num}</span>
                <span className="text-xs text-[#9CA3AF]">Init: {p.pvicInit}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9CA3AF]">Actuel:</span>
                <input
                  type="number"
                  value={p.pvicCurrent}
                  onChange={(e) => {
                    const updated = [...finalDuelPlayers];
                    updated[i] = { ...p, pvicCurrent: parseInt(e.target.value) || 0 };
                    setFinalDuelPlayers(updated);
                  }}
                  className="w-16 bg-[#2A2215] border border-[#D4AF37]/30 rounded px-2 py-1 text-sm text-[#E8E8E8]"
                />
                <span className={`text-xs ${p.pvicCurrent - p.pvicInit >= 0 ? 'text-[#4ADE80]' : 'text-[#EF4444]'}`}>
                  ({p.pvicCurrent - p.pvicInit > 0 ? '+' : ''}{p.pvicCurrent - p.pvicInit})
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-[#F59E0B] flex-shrink-0" />
          <div>
            <p className="text-sm text-[#F59E0B] font-medium">Challenger sélectionné:</p>
            <p className="text-sm text-[#E8E8E8]">
              <strong>Joueur #{findBiggestLoser().loser.num}</strong> — Delta: {findBiggestLoser().delta} PVic
            </p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Ce joueur devra re-choisir ses jetons (21-30) pour le dernier duel
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
