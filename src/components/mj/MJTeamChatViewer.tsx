import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Users, Eye } from 'lucide-react';

interface MJTeamChatViewerProps {
  gameId: string;
}

interface Message {
  id: string;
  sender_num: number;
  sender_name: string;
  mate_group: number;
  message: string;
  created_at: string;
}

interface MateGroup {
  mate_num: number;
  players: { player_number: number; display_name: string }[];
}

const MJTeamChatViewer: React.FC<MJTeamChatViewerProps> = ({ gameId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mateGroups, setMateGroups] = useState<MateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Fetch mate groups
  useEffect(() => {
    const fetchMateGroups = async () => {
      const { data, error } = await supabase
        .from('game_players')
        .select('player_number, display_name, mate_num')
        .eq('game_id', gameId)
        .not('mate_num', 'is', null)
        .in('status', ['ACTIVE', 'IN_QUEUE'])
        .order('mate_num');

      if (!error && data) {
        const groups: Record<number, MateGroup> = {};
        data.forEach((player) => {
          if (player.mate_num !== null) {
            if (!groups[player.mate_num]) {
              groups[player.mate_num] = { mate_num: player.mate_num, players: [] };
            }
            groups[player.mate_num].players.push({
              player_number: player.player_number!,
              display_name: player.display_name,
            });
          }
        });
        setMateGroups(Object.values(groups));
      }
    };

    fetchMateGroups();
  }, [gameId]);

  // Limit messages to prevent memory bloat
  const MAX_MESSAGES = 200;
  const trimToLast = <T,>(arr: T[], max: number): T[] => 
    arr.length > max ? arr.slice(arr.length - max) : arr;

  // Fetch and subscribe to messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      let query = supabase
        .from('team_messages')
        .select('id, sender_num, sender_name, mate_group, message, created_at')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(MAX_MESSAGES);

      if (selectedGroup !== 'all') {
        query = query.eq('mate_group', parseInt(selectedGroup));
      }

      const { data, error } = await query;

      if (!error && data) {
        // Reverse to show oldest first
        setMessages(data.reverse());
      }
      setLoading(false);
    };

    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`mj-team-chat-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (selectedGroup === 'all' || newMsg.mate_group === parseInt(selectedGroup)) {
            // Trim to MAX_MESSAGES to prevent unbounded growth
            setMessages((prev) => trimToLast([...prev, newMsg], MAX_MESSAGES));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, selectedGroup]);

  const getGroupLabel = (mateNum: number) => {
    const group = mateGroups.find((g) => g.mate_num === mateNum);
    if (!group) return `Groupe ${mateNum}`;
    return group.players.map((p) => p.display_name).join(' & ');
  };

  return (
    <div className="card-gradient rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50 bg-card/50">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Conversations Coéquipiers</span>
          <span className="text-xs text-muted-foreground">(lecture seule)</span>
        </div>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Filtrer par groupe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les groupes</SelectItem>
            {mateGroups.map((group) => (
              <SelectItem key={group.mate_num} value={group.mate_num.toString()}>
                {getGroupLabel(group.mate_num)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages */}
      <ScrollArea className="h-64 p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Chargement...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">Aucun message dans cette conversation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col items-start">
                <div className="bg-muted/50 rounded-lg px-3 py-2 max-w-[90%]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-primary">{msg.sender_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      (Groupe {msg.mate_group})
                    </span>
                  </div>
                  <p className="text-sm break-words">{msg.message}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with groups summary */}
      {mateGroups.length > 0 && (
        <div className="p-2 border-t border-border/50 bg-card/30">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {mateGroups.length} groupe(s) de coéquipiers
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MJTeamChatViewer;
