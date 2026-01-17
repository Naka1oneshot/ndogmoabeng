import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Swords, ShoppingBag } from 'lucide-react';
import { PhasePanel } from './PhasePanel';
import { ShopPanel } from './ShopPanel';
import { BettingPanel } from './BettingPanel';
import { CombatPanel } from './CombatPanel';

interface Game {
  id: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
}

interface Player {
  id: string;
  displayName: string;
  playerNumber: number;
  jetons: number;
  recompenses: number;
  clan: string | null;
  mateNum: number | null;
  playerToken?: string;
}

interface PlayerActionTabsProps {
  game: Game;
  player: Player;
  className?: string;
}

// Map phases to corresponding tabs
const phaseToTab: Record<string, string> = {
  'PHASE1_MISES': 'mises',
  'PHASE2_POSITIONS': 'combats',
  'PHASE3_SHOP': 'shop',
  'PHASE4_COMBAT': 'combats',
  'RESOLUTION': 'combats',
};

export function PlayerActionTabs({ game, player, className }: PlayerActionTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('mises');

  // Auto-switch tab when phase changes
  useEffect(() => {
    const targetTab = phaseToTab[game.phase] || 'mises';
    setActiveTab(targetTab);
  }, [game.phase]);

  // Check if tab is active phase for visual indicator
  const isActivePhase = (tab: string) => {
    return phaseToTab[game.phase] === tab;
  };

  return (
    <div className={`card-gradient rounded-lg border border-border overflow-hidden ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-12 rounded-none bg-secondary/50">
          <TabsTrigger 
            value="mises" 
            className={`flex items-center gap-2 data-[state=active]:bg-background rounded-none ${
              isActivePhase('mises') ? 'text-yellow-500' : ''
            }`}
          >
            <Coins className={`h-4 w-4 ${isActivePhase('mises') ? 'animate-pulse' : ''}`} />
            <span className="text-sm">Mises</span>
            {isActivePhase('mises') && (
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="combats" 
            className={`flex items-center gap-2 data-[state=active]:bg-background rounded-none ${
              isActivePhase('combats') ? 'text-red-500' : ''
            }`}
          >
            <Swords className={`h-4 w-4 ${isActivePhase('combats') ? 'animate-pulse' : ''}`} />
            <span className="text-sm">Combats</span>
            {isActivePhase('combats') && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="shop" 
            className={`flex items-center gap-2 data-[state=active]:bg-background rounded-none ${
              isActivePhase('shop') ? 'text-green-500' : ''
            }`}
          >
            <ShoppingBag className={`h-4 w-4 ${isActivePhase('shop') ? 'animate-pulse' : ''}`} />
            <span className="text-sm">Shop</span>
            {isActivePhase('shop') && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mises" className="m-0">
          <BettingPanel game={game} player={player} />
        </TabsContent>

        <TabsContent value="combats" className="m-0">
          <CombatPanel game={game} player={player} />
        </TabsContent>

        <TabsContent value="shop" className="m-0">
          <ShopPanel game={game} player={player} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
