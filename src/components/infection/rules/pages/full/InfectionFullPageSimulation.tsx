import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Users, Clock, Target, Shield, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { InfectionRulesContextData } from '../../useInfectionRulesContext';

interface Props {
  context: InfectionRulesContextData;
  replayNonce: number;
}

interface ShotEntry {
  id: number;
  shooterNum: number;
  targetNum: number;
  timestamp: number;
  hasVest: boolean;
  isEzkarKK: boolean;
}

export function InfectionFullPageSimulation({ context, replayNonce }: Props) {
  const [activeSection, setActiveSection] = useState<'timeline' | 'propagation' | 'shots'>('timeline');

  // Timeline steps
  const timelineSteps = [
    { id: 1, name: "Actions", desc: "Soumission secrète des choix", color: "#D4AF37" },
    { id: 2, name: "Corruption", desc: "AE sabotage + paiements", color: "#E6A23C" },
    { id: 3, name: "Tirs", desc: "Résolution par timestamp", color: "#B00020" },
    { id: 4, name: "Test anticorps", desc: "Vote public, résultat privé", color: "#2AB3A6" },
    { id: 5, name: "Recherche SY", desc: "Progression mission", color: "#2AB3A6" },
    { id: 6, name: "Propagation", desc: "Max 2 nouvelles infections", color: "#B00020" },
  ];

  // Shots simulator
  const [shots, setShots] = useState<ShotEntry[]>([
    { id: 1, shooterNum: 5, targetNum: 3, timestamp: 1000, hasVest: true, isEzkarKK: false },
    { id: 2, shooterNum: 2, targetNum: 7, timestamp: 1500, hasVest: false, isEzkarKK: false },
    { id: 3, shooterNum: 8, targetNum: 3, timestamp: 2000, hasVest: true, isEzkarKK: false },
  ]);
  const [shotResults, setShotResults] = useState<Array<{ id: number; result: string; color: string }>>([]);

  const simulateShots = () => {
    // Sort by timestamp
    const sorted = [...shots].sort((a, b) => a.timestamp - b.timestamp);
    const deadTargets = new Set<number>();
    const vestUsed = new Set<number>();
    const results: Array<{ id: number; result: string; color: string }> = [];

    for (const shot of sorted) {
      if (deadTargets.has(shot.targetNum)) {
        results.push({ id: shot.id, result: `J${shot.targetNum} déjà mort`, color: "#6B7280" });
        continue;
      }

      // Vest logic
      if (shot.hasVest && !vestUsed.has(shot.targetNum)) {
        // Exception: Ezkar KK vest doesn't protect
        if (shot.isEzkarKK) {
          deadTargets.add(shot.targetNum);
          results.push({ id: shot.id, result: `J${shot.targetNum} mort (Ezkar KK, gilet inefficace)`, color: "#B00020" });
        } else {
          vestUsed.add(shot.targetNum);
          results.push({ id: shot.id, result: `J${shot.targetNum} protégé par gilet`, color: "#2AB3A6" });
        }
      } else {
        deadTargets.add(shot.targetNum);
        results.push({ id: shot.id, result: `J${shot.targetNum} mort`, color: "#B00020" });
      }
    }

    setShotResults(results);
  };

  const updateShot = (id: number, field: keyof ShotEntry, value: any) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    setShotResults([]);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-[#D4AF37] mb-2">
          Simulation complète
        </h2>
        <p className="text-[#9CA3AF]">
          Visualisez le déroulement d'une manche
        </p>
      </div>

      {/* Section selector */}
      <div className="flex gap-2 justify-center flex-wrap">
        {[
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'shots', label: 'Tirs & Gilet', icon: Target },
        ].map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activeSection === id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection(id as any)}
            className={activeSection === id ? 'bg-[#D4AF37] text-[#0B0E14]' : ''}
          >
            <Icon className="h-4 w-4 mr-1" />
            {label}
          </Button>
        ))}
      </div>

      {/* Timeline section */}
      {activeSection === 'timeline' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
        >
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#D4AF37]" />
            Déroulé d'une manche
          </h3>

          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[#2D3748]" />
            <div className="space-y-3">
              {timelineSteps.map((step, i) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-3 relative"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 shrink-0"
                    style={{ backgroundColor: `${step.color}30`, color: step.color, border: `2px solid ${step.color}` }}
                  >
                    {step.id}
                  </div>
                  <div className="bg-[#0B0E14] rounded-lg p-2 flex-1">
                    <span className="font-medium text-white text-sm">{step.name}</span>
                    <p className="text-xs text-[#6B7280]">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Shots section */}
      {activeSection === 'shots' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-[#121A2B] border border-[#2D3748] rounded-lg p-4"
        >
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-[#B00020]" />
            Simulation tirs + gilet
          </h3>

          <div className="space-y-3 mb-4">
            {shots.map((shot) => (
              <div key={shot.id} className="bg-[#0B0E14] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline">J{shot.shooterNum}</Badge>
                  <ArrowDown className="h-4 w-4 text-[#B00020]" />
                  <Badge variant="outline">J{shot.targetNum}</Badge>
                  <span className="text-xs text-[#6B7280]">@{shot.timestamp}ms</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <Switch 
                      checked={shot.hasVest} 
                      onCheckedChange={(v) => updateShot(shot.id, 'hasVest', v)} 
                    />
                    <span className="text-[#9CA3AF]">Gilet</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch 
                      checked={shot.isEzkarKK} 
                      onCheckedChange={(v) => updateShot(shot.id, 'isEzkarKK', v)} 
                    />
                    <span className="text-[#9CA3AF]">Ezkar KK</span>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={simulateShots} className="w-full bg-[#B00020] hover:bg-[#8B0018]">
            <Play className="h-4 w-4 mr-2" />
            Simuler les tirs
          </Button>

          {shotResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium text-white">Résultats (par ordre de timestamp) :</h4>
              {shotResults.map((r) => (
                <div 
                  key={r.id} 
                  className="text-sm px-3 py-2 rounded"
                  style={{ backgroundColor: `${r.color}20`, color: r.color }}
                >
                  Tir #{r.id}: {r.result}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
