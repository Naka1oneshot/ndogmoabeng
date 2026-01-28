import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MJPlayersTab } from '@/components/mj/MJPlayersTab';
import { MJBetsTab } from '@/components/mj/MJBetsTab';
import { MJPhase2Tab } from '@/components/mj/MJPhase2Tab';
import { MJInventoryTab } from '@/components/mj/MJInventoryTab';
import { MJCombatTab } from '@/components/mj/MJCombatTab';
import { MJEventsTab } from '@/components/mj/MJEventsTab';
import { MJMonstersConfigTab } from '@/components/mj/MJMonstersConfigTab';
import { MJItemsShopTab } from '@/components/mj/MJItemsShopTab';
import { MJShopPhaseTab } from '@/components/mj/MJShopPhaseTab';
import MJTeamChatViewer from '@/components/mj/MJTeamChatViewer';
import {
  Users, Coins, Package, MessageSquare,
  Bug, Store, Swords, Target
} from 'lucide-react';

interface Game {
  id: string;
  name: string;
  join_code: string;
  status: string;
  manche_active: number;
  phase: string;
  phase_locked: boolean;
  starting_tokens: number;
  x_nb_joueurs: number;
  sens_depart_egalite: string;
  created_at: string;
  current_session_game_id: string | null;
  mode: string;
  adventure_id: string | null;
  current_step_index: number;
  selected_game_type_code: string | null;
}

interface MJForetDashboardProps {
  game: Game;
  isAdventure: boolean;
  onNextGame?: () => void;
  onGameUpdate: () => void;
}

export function MJForetDashboard({ game, isAdventure, onNextGame, onGameUpdate }: MJForetDashboardProps) {
  return (
    <Tabs defaultValue="players" className="w-full">
      {/* Primary tabs - 4 cols on mobile, 8 on desktop */}
      <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 h-auto">
        <TabsTrigger value="players" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Joueurs</span>
        </TabsTrigger>
        <TabsTrigger value="bets" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <Coins className="h-4 w-4" />
          <span className="hidden sm:inline">Phase 1</span>
        </TabsTrigger>
        <TabsTrigger value="phase2" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <Target className="h-4 w-4" />
          <span className="hidden sm:inline">Phase 2</span>
        </TabsTrigger>
        <TabsTrigger value="shop" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <Store className="h-4 w-4" />
          <span className="hidden sm:inline">Phase 3</span>
        </TabsTrigger>
        <TabsTrigger value="monsters" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <Bug className="h-4 w-4" />
          <span className="hidden md:inline">Monstres</span>
        </TabsTrigger>
        <TabsTrigger value="inventory" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <Package className="h-4 w-4" />
          <span className="hidden md:inline">Inventaires</span>
        </TabsTrigger>
        <TabsTrigger value="combat" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <Swords className="h-4 w-4" />
          <span className="hidden md:inline">Combat</span>
        </TabsTrigger>
        <TabsTrigger value="events" className="flex items-center gap-1 py-2 px-1 sm:px-3">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden md:inline">Events</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="players" className="mt-6">
        <MJPlayersTab game={game} onGameUpdate={onGameUpdate} />
      </TabsContent>

      <TabsContent value="bets" className="mt-6">
        <MJBetsTab game={game} onGameUpdate={onGameUpdate} />
      </TabsContent>

      <TabsContent value="phase2" className="mt-6">
        <MJPhase2Tab game={game} onGameUpdate={onGameUpdate} />
      </TabsContent>

      <TabsContent value="shop" className="mt-6">
        <div className="space-y-6">
          <MJShopPhaseTab game={game} />
          <hr className="border-border" />
          <MJItemsShopTab game={game} />
        </div>
      </TabsContent>

      <TabsContent value="monsters" className="mt-6">
        <MJMonstersConfigTab game={game} />
      </TabsContent>

      <TabsContent value="inventory" className="mt-6">
        <MJInventoryTab game={game} />
      </TabsContent>

      <TabsContent value="combat" className="mt-6">
        <MJCombatTab 
          game={game}
          phase={game.phase}
          isAdventure={isAdventure}
          onNextGame={isAdventure ? onNextGame : undefined}
        />
      </TabsContent>

      <TabsContent value="events" className="mt-6">
        <MJEventsTab game={game} />
        <div className="mt-6">
          <MJTeamChatViewer gameId={game.id} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
