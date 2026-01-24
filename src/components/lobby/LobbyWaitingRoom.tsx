import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, MessageCircle, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import LobbyPlayerList from './LobbyPlayerList';
import LobbyChat from './LobbyChat';
import { InviteFriendsModal } from '@/components/game/InviteFriendsModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdventureProgressDisplay } from '@/components/game/AdventureProgressDisplay';

interface LobbyWaitingRoomProps {
  gameId: string;
  playerNum: number;
  playerName: string;
}

interface GameInfo {
  name: string;
  join_code: string;
  mode?: string;
  adventure_id?: string | null;
  current_step_index?: number;
  selected_game_type_code?: string | null;
}

const LobbyWaitingRoom: React.FC<LobbyWaitingRoomProps> = ({
  gameId,
  playerNum,
  playerName,
}) => {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>('players');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);

  useEffect(() => {
    const fetchGameInfo = async () => {
      const { data } = await supabase
        .from('games')
        .select('name, join_code, mode, adventure_id, current_step_index, selected_game_type_code')
        .eq('id', gameId)
        .single();
      if (data) {
        setGameInfo(data);
      }
    };
    fetchGameInfo();
  }, [gameId]);

  // Mobile: Tabbed layout
  if (isMobile) {
    return (
      <>
        {/* Adventure Progress for mobile */}
        {gameInfo?.mode === 'ADVENTURE' && (
          <div className="card-gradient rounded-lg border border-primary/30 p-3 mb-4">
            <AdventureProgressDisplay
              mode={gameInfo.mode}
              currentStepIndex={gameInfo.current_step_index}
              currentGameTypeCode={gameInfo.selected_game_type_code}
              adventureId={gameInfo.adventure_id}
              showTitle={true}
            />
          </div>
        )}
        
        <div className="card-gradient rounded-lg border border-border overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between border-b border-border bg-card/50 px-2">
              <TabsList className="flex-1 grid grid-cols-2 rounded-none bg-transparent">
                <TabsTrigger value="players" className="flex items-center gap-2 data-[state=active]:bg-primary/10">
                  <Users className="h-4 w-4" />
                  <span>Joueurs en salle</span>
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center gap-2 data-[state=active]:bg-primary/10">
                  <MessageCircle className="h-4 w-4" />
                  <span>Chat</span>
                </TabsTrigger>
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInviteModalOpen(true)}
                className="ml-2"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            
            <TabsContent value="players" className="mt-0 p-4">
              <LobbyPlayerList gameId={gameId} currentPlayerNum={playerNum} />
            </TabsContent>
            
            <TabsContent value="chat" className="mt-0 h-[calc(100vh-280px)] min-h-[300px] flex flex-col">
              <LobbyChat
                gameId={gameId}
                playerNum={playerNum}
                playerName={playerName}
                maxHeight="none"
              />
            </TabsContent>
          </Tabs>
        </div>

        {gameInfo && (
          <InviteFriendsModal
            open={inviteModalOpen}
            onOpenChange={setInviteModalOpen}
            gameId={gameId}
            gameName={gameInfo.name}
            joinCode={gameInfo.join_code}
          />
        )}
      </>
    );
  }

  // Desktop: Side by side layout with aligned input
  return (
    <>
      {/* Adventure Progress for desktop */}
      {gameInfo?.mode === 'ADVENTURE' && (
        <div className="card-gradient rounded-lg border border-primary/30 p-4 mb-4">
          <AdventureProgressDisplay
            mode={gameInfo.mode}
            currentStepIndex={gameInfo.current_step_index}
            currentGameTypeCode={gameInfo.selected_game_type_code}
            adventureId={gameInfo.adventure_id}
            showTitle={true}
          />
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-4">
        {/* Player list */}
        <div className="card-gradient rounded-lg border border-border p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Salle d'attente</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInviteModalOpen(true)}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Inviter
            </Button>
          </div>
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

      {gameInfo && (
        <InviteFriendsModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          gameId={gameId}
          gameName={gameInfo.name}
          joinCode={gameInfo.join_code}
        />
      )}
    </>
  );
};

export default LobbyWaitingRoom;
