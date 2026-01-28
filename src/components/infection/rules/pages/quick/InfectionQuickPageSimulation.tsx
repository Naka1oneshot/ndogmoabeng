import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Users, ArrowRight } from 'lucide-react';
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

export function InfectionQuickPageSimulation({ context, replayNonce }: Props) {
  const [playerCount, setPlayerCount] = useState(9);
  const [patient0, setPatient0] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [hasSimulated, setHasSimulated] = useState(false);

  // Initialize players when count changes
  const initPlayers = () => {
    const newPlayers: PlayerState[] = [];
    for (let i = 1; i <= playerCount; i++) {
      newPlayers.push({ num: i, isAlive: true, isCarrier: false });
    }
    setPlayers(newPlayers);
    setPatient0(null);
    setHasSimulated(false);
  };

  // Toggle player state
  const toggleAlive = (num: number) => {
    setPlayers(prev => prev.map(p => 
      p.num === num ? { ...p, isAlive: !p.isAlive } : p
    ));
  };

  const toggleCarrier = (num: number) => {
    setPlayers(prev => prev.map(p => 
      p.num === num ? { ...p, isCarrier: !p.isCarrier } : p
    ));
  };

  const selectPatient0 = (num: number) => {
    if (patient0 === num) {
      setPatient0(null);
    } else {
      setPatient0(num);
      // Also set as carrier
      setPlayers(prev => prev.map(p => 
        p.num === num ? { ...p, isCarrier: true } : p
      ));
    }
  };

  // Simulate propagation
  const simulatePropagation = () => {
    if (players.length === 0) return;

    const newPlayers = [...players].map(p => ({ ...p, isNewlyInfected: false }));
    let newInfections = 0;
    const maxInfections = 2;

    // Find all carriers
    const carriers = newPlayers.filter(p => p.isCarrier && p.isAlive);

    for (const carrier of carriers) {
      if (newInfections >= maxInfections) break;

      // Try left
      let leftFound = false;
      for (let offset = 1; offset < playerCount && !leftFound; offset++) {
        const leftNum = ((carrier.num - 1 - offset + playerCount) % playerCount) + 1;
        const leftPlayer = newPlayers.find(p => p.num === leftNum);
        if (leftPlayer) {
          if (!leftPlayer.isAlive) continue; // Skip dead
          if (leftPlayer.isCarrier) {
            leftFound = true; // Stop in this direction
          } else {
            // Infect
            leftPlayer.isCarrier = true;
            leftPlayer.isNewlyInfected = true;
            newInfections++;
            leftFound = true;
          }
        }
      }

      if (newInfections >= maxInfections) break;

      // Try right
      let rightFound = false;
      for (let offset = 1; offset < playerCount && !rightFound; offset++) {
        const rightNum = ((carrier.num - 1 + offset) % playerCount) + 1;
        const rightPlayer = newPlayers.find(p => p.num === rightNum);
        if (rightPlayer) {
          if (!rightPlayer.isAlive) continue; // Skip dead
          if (rightPlayer.isCarrier) {
            rightFound = true; // Stop in this direction
          } else {
            // Infect
            rightPlayer.isCarrier = true;
            rightPlayer.isNewlyInfected = true;
            newInfections++;
            rightFound = true;
          }
        }
      }
    }

    setPlayers(newPlayers);
    setHasSimulated(true);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          Simulation Propagation
        </h2>
        <p className="text-[#9CA3AF]">
          Testez l'algorithme de propagation du virus
        </p>
      </div>

      {/* Player count slider */}
      <div className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[#9CA3AF]">Nombre de joueurs</span>
          <span className="font-bold text-[#D4AF37]">{playerCount}</span>
        </div>
        <Slider
          value={[playerCount]}
          onValueChange={([v]) => setPlayerCount(v)}
          min={7}
          max={12}
          step={1}
          className="mb-4"
        />
        <Button onClick={initPlayers} variant="outline" size="sm" className="w-full">
          <Users className="h-4 w-4 mr-2" />
          Initialiser les joueurs
        </Button>
      </div>

      {/* Players circle */}
      {players.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
        >
          <p className="text-xs text-[#6B7280] mb-3 text-center">
            Cliquez pour sélectionner Patient 0 • Double-clic pour mort/vivant
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {players.map((p) => (
              <button
                key={p.num}
                onClick={() => selectPatient0(p.num)}
                onDoubleClick={() => toggleAlive(p.num)}
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all border-2
                  ${!p.isAlive 
                    ? 'bg-[#1A2235] border-[#6B7280] text-[#6B7280] line-through' 
                    : p.isNewlyInfected
                      ? 'bg-[#E6A23C]/30 border-[#E6A23C] text-[#E6A23C] animate-pulse'
                      : p.isCarrier 
                        ? 'bg-[#B00020]/30 border-[#B00020] text-[#B00020]' 
                        : patient0 === p.num
                          ? 'bg-[#D4AF37]/30 border-[#D4AF37] text-[#D4AF37]'
                          : 'bg-[#0B0E14] border-[#2D3748] text-white hover:border-[#D4AF37]'
                  }
                `}
              >
                {p.num}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-3 text-xs mb-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#B00020]" /> Porteur
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#E6A23C]" /> Nouveau
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-[#6B7280]" /> Mort
            </span>
          </div>

          {/* Simulate button */}
          <div className="flex gap-2">
            <Button 
              onClick={simulatePropagation} 
              className="flex-1 bg-[#B00020] hover:bg-[#8B0018]"
            >
              <Play className="h-4 w-4 mr-2" />
              Simuler propagation
            </Button>
            <Button onClick={initPlayers} variant="outline" size="icon">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {hasSimulated && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-[#2AB3A6] mt-3"
            >
              Propagation terminée ! Max 2 nouvelles infections appliquées.
            </motion.p>
          )}
        </motion.div>
      )}

      {/* Reminder */}
      <div className="bg-[#0B0E14] border border-[#D4AF37]/20 rounded-lg p-4 text-sm text-[#9CA3AF]">
        <p className="mb-2"><strong className="text-[#D4AF37]">Rappel :</strong></p>
        <ul className="space-y-1 text-xs">
          <li>• La propagation va gauche/droite depuis chaque porteur</li>
          <li>• Elle saute les joueurs morts</li>
          <li>• Elle s'arrête dans une direction si le voisin est déjà porteur</li>
          <li>• Maximum 2 nouvelles infections par manche (toutes directions confondues)</li>
        </ul>
      </div>
    </div>
  );
}
