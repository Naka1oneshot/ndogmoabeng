import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Users, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

interface PlayerState {
  num: number;
  isAlive: boolean;
  isCarrier: boolean;
  isNewlyInfected?: boolean;
}

export function InfectionFullPagePropagation({ context, replayNonce }: Props) {
  const [playerCount, setPlayerCount] = useState(9);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [hasSimulated, setHasSimulated] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);

  const initPlayers = () => {
    const newPlayers: PlayerState[] = [];
    for (let i = 1; i <= playerCount; i++) {
      newPlayers.push({ 
        num: i, 
        isAlive: true, 
        isCarrier: i === 3, // Default: player 3 is carrier
      });
    }
    setPlayers(newPlayers);
    setHasSimulated(false);
    setSimulationLog([]);
  };

  const toggleAlive = (num: number) => {
    setPlayers(prev => prev.map(p => 
      p.num === num ? { ...p, isAlive: !p.isAlive, isNewlyInfected: false } : p
    ));
    setHasSimulated(false);
  };

  const toggleCarrier = (num: number) => {
    setPlayers(prev => prev.map(p => 
      p.num === num ? { ...p, isCarrier: !p.isCarrier, isNewlyInfected: false } : p
    ));
    setHasSimulated(false);
  };

  const simulatePropagation = () => {
    if (players.length === 0) return;

    const newPlayers = [...players].map(p => ({ ...p, isNewlyInfected: false }));
    let newInfections = 0;
    const maxInfections = 2;
    const logs: string[] = [];

    const carriers = newPlayers.filter(p => p.isCarrier && p.isAlive);
    logs.push(`🦠 ${carriers.length} porteur(s) actif(s): ${carriers.map(c => `J${c.num}`).join(', ')}`);

    for (const carrier of carriers) {
      if (newInfections >= maxInfections) {
        logs.push(`⚠️ Max 2 infections atteint, arrêt.`);
        break;
      }

      // Left direction
      logs.push(`\n👈 J${carrier.num} tente gauche...`);
      for (let offset = 1; offset < playerCount; offset++) {
        const leftNum = ((carrier.num - 1 - offset + playerCount) % playerCount) + 1;
        const leftPlayer = newPlayers.find(p => p.num === leftNum);
        if (!leftPlayer) continue;
        
        if (!leftPlayer.isAlive) {
          logs.push(`   J${leftNum} mort, saute.`);
          continue;
        }
        if (leftPlayer.isCarrier) {
          logs.push(`   J${leftNum} déjà porteur → STOP gauche.`);
          break;
        }
        // Infect
        leftPlayer.isCarrier = true;
        leftPlayer.isNewlyInfected = true;
        newInfections++;
        logs.push(`   ✅ J${leftNum} infecté ! (${newInfections}/2)`);
        break;
      }

      if (newInfections >= maxInfections) continue;

      // Right direction
      logs.push(`\n👉 J${carrier.num} tente droite...`);
      for (let offset = 1; offset < playerCount; offset++) {
        const rightNum = ((carrier.num - 1 + offset) % playerCount) + 1;
        const rightPlayer = newPlayers.find(p => p.num === rightNum);
        if (!rightPlayer) continue;
        
        if (!rightPlayer.isAlive) {
          logs.push(`   J${rightNum} mort, saute.`);
          continue;
        }
        if (rightPlayer.isCarrier) {
          logs.push(`   J${rightNum} déjà porteur → STOP droite.`);
          break;
        }
        // Infect
        rightPlayer.isCarrier = true;
        rightPlayer.isNewlyInfected = true;
        newInfections++;
        logs.push(`   ✅ J${rightNum} infecté ! (${newInfections}/2)`);
        break;
      }
    }

    logs.push(`\n📊 Résultat: ${newInfections} nouvelle(s) infection(s)`);
    
    setPlayers(newPlayers);
    setSimulationLog(logs);
    setHasSimulated(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          Propagation du virus
        </h2>
        <p className="text-[#9CA3AF]">
          L'algorithme de contamination expliqué et simulé
        </p>
      </div>

      {/* Rules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#B00020]/10 border border-[#B00020]/30 rounded-lg p-4"
      >
        <h3 className="font-semibold text-[#B00020] mb-3">Règles de propagation</h3>
        <ul className="space-y-2 text-sm text-[#9CA3AF]">
          <li className="flex items-start gap-2">
            <ArrowLeft className="h-4 w-4 text-[#B00020] mt-0.5 shrink-0" />
            <span>Chaque porteur vivant contamine vers la <strong className="text-white">gauche</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="h-4 w-4 text-[#B00020] mt-0.5 shrink-0" />
            <span>Et vers la <strong className="text-white">droite</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B00020]">•</span>
            <span>Saute les joueurs <strong className="text-white">morts</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B00020]">•</span>
            <span>S'arrête si le voisin est <strong className="text-white">déjà porteur</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#D4AF37]">⚠️</span>
            <span><strong className="text-[#D4AF37]">Maximum 2 nouvelles infections</strong> par manche (toutes directions confondues)</span>
          </li>
        </ul>
      </motion.div>

      {/* Simulator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
      >
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#D4AF37]" />
          Simulateur
        </h3>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#9CA3AF]">Joueurs: {playerCount}</span>
          <Slider
            value={[playerCount]}
            onValueChange={([v]) => setPlayerCount(v)}
            min={7}
            max={12}
            step={1}
            className="w-32"
          />
        </div>

        <Button onClick={initPlayers} variant="outline" size="sm" className="w-full mb-4">
          Initialiser (J3 = porteur)
        </Button>

        {players.length > 0 && (
          <>
            <p className="text-xs text-[#6B7280] mb-2">
              Clic = porteur | Double-clic = mort/vivant
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {players.map((p) => (
                <button
                  key={p.num}
                  onClick={() => toggleCarrier(p.num)}
                  onDoubleClick={() => toggleAlive(p.num)}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                    transition-all border-2
                    ${!p.isAlive 
                      ? 'bg-[#1A2235] border-[#6B7280] text-[#6B7280] line-through' 
                      : p.isNewlyInfected
                        ? 'bg-[#E6A23C]/30 border-[#E6A23C] text-[#E6A23C] animate-pulse'
                        : p.isCarrier 
                          ? 'bg-[#B00020]/30 border-[#B00020] text-[#B00020]' 
                          : 'bg-[#0B0E14] border-[#2D3748] text-white hover:border-[#D4AF37]'
                    }
                  `}
                >
                  {p.num}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <Button 
                onClick={simulatePropagation} 
                className="flex-1 bg-[#B00020] hover:bg-[#8B0018]"
              >
                <Play className="h-4 w-4 mr-2" />
                Simuler
              </Button>
              <Button onClick={initPlayers} variant="outline" size="icon">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {hasSimulated && simulationLog.length > 0 && (
              <div className="bg-[#0B0E14] rounded p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-[#9CA3AF] whitespace-pre-wrap font-mono">
                  {simulationLog.join('\n')}
                </pre>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
