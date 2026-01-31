import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Mail, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInfectionThemeClasses, INFECTION_ROLE_LABELS } from './InfectionTheme';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  role_code: string | null;
  is_alive: boolean | null;
}

interface MJPrivateMessagingProps {
  gameId: string;
  sessionGameId: string;
  manche: number;
  players: Player[];
}

export function MJPrivateMessaging({ gameId, sessionGameId, manche, players }: MJPrivateMessagingProps) {
  const theme = getInfectionThemeClasses();
  const [selectedPlayerNum, setSelectedPlayerNum] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [recentMessages, setRecentMessages] = useState<Array<{
    playerNum: number;
    playerName: string;
    message: string;
    sentAt: Date;
  }>>([]);

  // Filter active players (with player_number)
  const activePlayers = players.filter(p => p.player_number !== null && !p.is_alive === false);

  const getRoleColor = (role: string | null) => {
    switch (role) {
      case 'PV': return '#B00020';
      case 'BA': return '#6B21A8';
      case 'SY': return '#2AB3A6';
      case 'OC': return '#E6A23C';
      case 'AE': return '#3B82F6';
      case 'CV': return '#6B7280';
      case 'KK': return '#D4AF37';
      default: return '#9CA3AF';
    }
  };

  const handleSendMessage = async () => {
    if (!selectedPlayerNum || !message.trim()) {
      toast.error('Sélectionnez un joueur et entrez un message');
      return;
    }

    const playerNum = parseInt(selectedPlayerNum);
    const player = activePlayers.find(p => p.player_number === playerNum);
    
    if (!player) {
      toast.error('Joueur non trouvé');
      return;
    }

    setSending(true);
    try {
      // Insert a private game event for the player
      const { error } = await supabase
        .from('game_events')
        .insert({
          game_id: gameId,
          session_game_id: sessionGameId,
          manche: manche,
          phase: 'MJ_MESSAGE',
          visibility: 'PRIVATE',
          event_type: 'MJ_PRIVATE_MESSAGE',
          player_num: playerNum,
          message: message.trim(),
          payload: { from: 'MJ' },
        });

      if (error) throw error;

      // Add to recent messages list
      setRecentMessages(prev => [{
        playerNum,
        playerName: player.display_name,
        message: message.trim(),
        sentAt: new Date(),
      }, ...prev.slice(0, 9)]); // Keep last 10

      toast.success(`Message envoyé à #${playerNum} ${player.display_name}`);
      setMessage('');
      setSelectedPlayerNum('');
    } catch (err: any) {
      console.error('[MJ] Send private message error:', err);
      toast.error(err.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={theme.card}>
      <div className="p-3 border-b border-[#2D3748] flex items-center gap-2">
        <Mail className="h-4 w-4 text-[#D4AF37]" />
        <span className="font-semibold text-[#EAEAF2]">Messages privés MJ → Joueur</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Player selection */}
        <div className="space-y-2">
          <label className="text-sm text-[#9CA3AF]">Destinataire</label>
          <Select value={selectedPlayerNum} onValueChange={setSelectedPlayerNum}>
            <SelectTrigger className="w-full bg-[#0B0E14] border-[#2D3748]">
              <SelectValue placeholder="Sélectionner un joueur..." />
            </SelectTrigger>
            <SelectContent className="bg-[#121A2B] border-[#2D3748]">
              {activePlayers.map(player => (
                <SelectItem 
                  key={player.id} 
                  value={String(player.player_number)}
                  className="hover:bg-[#1A2235]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#6B7280]">#{player.player_number}</span>
                    <span>{player.display_name}</span>
                    {player.role_code && (
                      <Badge 
                        variant="outline" 
                        className="text-[10px] px-1 ml-1"
                        style={{ borderColor: getRoleColor(player.role_code), color: getRoleColor(player.role_code) }}
                      >
                        {INFECTION_ROLE_LABELS[player.role_code]?.short || player.role_code}
                      </Badge>
                    )}
                    {player.is_alive === false && (
                      <span className="text-[#B00020] text-xs">💀</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Message input */}
        <div className="space-y-2">
          <label className="text-sm text-[#9CA3AF]">Message</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Écrivez votre message privé..."
            className="bg-[#0B0E14] border-[#2D3748] min-h-[80px] resize-none"
            disabled={sending}
          />
        </div>

        {/* Send button */}
        <Button
          onClick={handleSendMessage}
          disabled={sending || !selectedPlayerNum || !message.trim()}
          className="w-full bg-[#D4AF37] hover:bg-[#C9A030] text-black"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Envoi...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Envoyer le message privé
            </>
          )}
        </Button>

        {/* Recent messages */}
        {recentMessages.length > 0 && (
          <div className="pt-4 border-t border-[#2D3748]">
            <h4 className="text-sm text-[#9CA3AF] mb-2">Messages récents envoyés</h4>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {recentMessages.map((msg, idx) => (
                  <div 
                    key={idx}
                    className="p-2 bg-[#1A2235] rounded-lg border-l-2 border-[#D4AF37]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1 text-xs">
                        <User className="h-3 w-3 text-[#6B7280]" />
                        <span className="text-[#D4AF37]">→ #{msg.playerNum}</span>
                        <span className="text-[#9CA3AF]">{msg.playerName}</span>
                      </div>
                      <span className="text-[10px] text-[#6B7280]">{formatTime(msg.sentAt)}</span>
                    </div>
                    <p className="text-xs text-[#E5E7EB] line-clamp-2">{msg.message}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
