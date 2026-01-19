import React, { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Users, MessageCircle } from 'lucide-react';
import LobbyPlayerList from './LobbyPlayerList';
import LobbyChat from './LobbyChat';

interface LobbyLayoutProps {
  gameId: string;
  playerNum: number;
  playerName: string;
}

const LobbyLayout: React.FC<LobbyLayoutProps> = ({ gameId, playerNum, playerName }) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>('players');
  const playerListRef = useRef<HTMLDivElement>(null);
  const [playerListHeight, setPlayerListHeight] = useState<number>(300);

  // Observe player list height changes for desktop sync
  useEffect(() => {
    if (isMobile || !playerListRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        // Minimum height of 250px, max of 500px
        setPlayerListHeight(Math.max(250, Math.min(500, height)));
      }
    });

    resizeObserver.observe(playerListRef.current);

    return () => resizeObserver.disconnect();
  }, [isMobile]);

  // Mobile: Tabs layout
  if (isMobile) {
    return (
      <div className="card-gradient rounded-lg border border-border overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-border bg-muted/30">
            <TabsTrigger 
              value="players" 
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <Users className="h-4 w-4" />
              <span>Joueurs</span>
            </TabsTrigger>
            <TabsTrigger 
              value="chat"
              className="flex items-center gap-2 data-[state=active]:bg-background"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chat</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="players" className="p-4 m-0">
            <LobbyPlayerList gameId={gameId} currentPlayerNum={playerNum} />
          </TabsContent>

          <TabsContent value="chat" className="m-0">
            <LobbyChat 
              gameId={gameId} 
              playerNum={playerNum} 
              playerName={playerName}
              maxHeight="350px"
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop: Side-by-side layout with synchronized height
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Player List */}
      <div 
        ref={playerListRef}
        className="card-gradient rounded-lg border border-border p-4"
      >
        <LobbyPlayerList gameId={gameId} currentPlayerNum={playerNum} />
      </div>

      {/* Chat - synced height with player list */}
      <div 
        className="card-gradient rounded-lg border border-border overflow-hidden"
        style={{ height: `${playerListHeight}px` }}
      >
        <LobbyChat 
          gameId={gameId} 
          playerNum={playerNum} 
          playerName={playerName}
          maxHeight={`${playerListHeight - 120}px`}
        />
      </div>
    </div>
  );
};

export default LobbyLayout;
