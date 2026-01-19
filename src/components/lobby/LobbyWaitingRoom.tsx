import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MessageCircle } from 'lucide-react';
import LobbyPlayerList from './LobbyPlayerList';
import LobbyChat from './LobbyChat';
import { useIsMobile } from '@/hooks/use-mobile';

interface LobbyWaitingRoomProps {
  gameId: string;
  playerNum: number;
  playerName: string;
}

const LobbyWaitingRoom: React.FC<LobbyWaitingRoomProps> = ({
  gameId,
  playerNum,
  playerName,
}) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>('players');

  // Mobile: Tabbed layout
  if (isMobile) {
    return (
      <div className="card-gradient rounded-lg border border-border overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-border bg-card/50">
            <TabsTrigger value="players" className="flex items-center gap-2 data-[state=active]:bg-primary/10">
              <Users className="h-4 w-4" />
              <span>Joueurs en salle</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2 data-[state=active]:bg-primary/10">
              <MessageCircle className="h-4 w-4" />
              <span>Chat</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="players" className="mt-0 p-4">
            <LobbyPlayerList gameId={gameId} currentPlayerNum={playerNum} />
          </TabsContent>
          
          <TabsContent value="chat" className="mt-0" style={{ minHeight: '350px' }}>
            <LobbyChat
              gameId={gameId}
              playerNum={playerNum}
              playerName={playerName}
              maxHeight="300px"
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Desktop: Side by side layout with aligned input
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Player list */}
      <div className="card-gradient rounded-lg border border-border p-4 flex flex-col">
        <LobbyPlayerList gameId={gameId} currentPlayerNum={playerNum} />
      </div>

      {/* Chat - flex to match height of player list */}
      <div className="card-gradient rounded-lg border border-border overflow-hidden flex flex-col">
        <LobbyChat
          gameId={gameId}
          playerNum={playerNum}
          playerName={playerName}
          maxHeight="none"
        />
      </div>
    </div>
  );
};

export default LobbyWaitingRoom;
