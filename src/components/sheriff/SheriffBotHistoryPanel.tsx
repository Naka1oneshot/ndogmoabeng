import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Bot, Eye, EyeOff, Dices, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BotLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string | null;
  manche: number | null;
}

interface SheriffBotHistoryPanelProps {
  gameId: string;
  sessionGameId: string;
}

export function SheriffBotHistoryPanel({ gameId, sessionGameId }: SheriffBotHistoryPanelProps) {
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('logs_mj')
        .select('id, timestamp, action, details, manche')
        .eq('game_id', gameId)
        .eq('session_game_id', sessionGameId)
        .in('action', ['BOT_SHERIFF_CHOICES', 'BOT_SHERIFF_DUELS', 'BOT_SHERIFF_DUELS_ALL'])
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching bot logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [gameId, sessionGameId]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'BOT_SHERIFF_CHOICES':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'BOT_SHERIFF_DUELS':
        return <Dices className="h-4 w-4 text-[#CD853F]" />;
      case 'BOT_SHERIFF_DUELS_ALL':
        return <Bot className="h-4 w-4 text-[#D4AF37]" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'BOT_SHERIFF_CHOICES':
        return 'Choix Visa/Jetons';
      case 'BOT_SHERIFF_DUELS':
        return 'Décision Duel';
      case 'BOT_SHERIFF_DUELS_ALL':
        return 'Auto Tous Duels';
      default:
        return action;
    }
  };

  const parseDetails = (details: string | null): any => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  const renderDetailsSummary = (action: string, details: any) => {
    if (!details) return null;
    
    if (action === 'BOT_SHERIFF_CHOICES' && details.results) {
      const results = details.results as any[];
      const pvCount = results.filter(r => r.visa_choice === 'VICTORY_POINTS').length;
      const illegalCount = results.filter(r => r.has_illegal_tokens).length;
      return (
        <div className="flex gap-2 text-xs mt-1">
          <Badge variant="outline" className="text-[#D4AF37]">{pvCount}/{results.length} visa PV</Badge>
          <Badge variant="outline" className="text-red-500">{illegalCount}/{results.length} contrebande</Badge>
        </div>
      );
    }
    
    if ((action === 'BOT_SHERIFF_DUELS' || action === 'BOT_SHERIFF_DUELS_ALL') && details.results) {
      const results = details.results as any[];
      const searchCount = results.filter(r => r.player1_searches === true || r.player2_searches === true).length;
      return (
        <div className="flex gap-2 text-xs mt-1">
          <Badge variant="outline" className="text-[#CD853F]">{results.length} décisions</Badge>
          <Badge variant="outline" className="text-orange-500">{searchCount} fouilles</Badge>
        </div>
      );
    }
    
    return null;
  };

  const renderExpandedDetails = (action: string, details: any) => {
    if (!details || !details.results) return null;
    
    const results = details.results as any[];
    
    if (action === 'BOT_SHERIFF_CHOICES') {
      return (
        <div className="mt-2 space-y-1 text-xs bg-[#1A1F2C] p-2 rounded">
          {results.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-[#2D3748]/50 last:border-0">
              <span className="text-[#9CA3AF]">Bot #{r.player_number}</span>
              <div className="flex gap-2">
                <Badge variant="outline" className={r.visa_choice === 'VICTORY_POINTS' ? 'text-[#D4AF37]' : 'text-blue-400'}>
                  {r.visa_choice === 'VICTORY_POINTS' ? 'Visa PV' : 'Visa Cagnotte'}
                </Badge>
                <Badge variant="outline" className={r.has_illegal_tokens ? 'text-red-500' : 'text-green-500'}>
                  {r.tokens_entering}💎 {r.has_illegal_tokens ? '⚠️' : '✓'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    if (action === 'BOT_SHERIFF_DUELS' || action === 'BOT_SHERIFF_DUELS_ALL') {
      return (
        <div className="mt-2 space-y-1 text-xs bg-[#1A1F2C] p-2 rounded">
          {results.map((r: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-[#2D3748]/50 last:border-0">
              <span className="text-[#9CA3AF]">Duel #{r.duel_order}</span>
              <div className="flex gap-2">
                {r.player1_searches !== undefined && (
                  <Badge variant="outline" className={r.player1_searches ? 'text-orange-500' : 'text-green-500'}>
                    P1: {r.player1_searches ? '🔍' : '✓'}
                  </Badge>
                )}
                {r.player2_searches !== undefined && (
                  <Badge variant="outline" className={r.player2_searches ? 'text-orange-500' : 'text-green-500'}>
                    P2: {r.player2_searches ? '🔍' : '✓'}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    return null;
  };

  if (logs.length === 0 && !loading) {
    return (
      <div className="text-center text-[#9CA3AF] py-4 text-sm">
        Aucune action bot enregistrée pour cette session
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[#D4AF37]">Historique des actions</h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-2">
          {logs.map((log) => {
            const details = parseDetails(log.details);
            const isExpanded = expanded === log.id;
            
            return (
              <div 
                key={log.id} 
                className="bg-[#2D3748]/50 rounded p-2 cursor-pointer hover:bg-[#2D3748]/70 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : log.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getActionIcon(log.action)}
                    <div>
                      <div className="text-sm font-medium">{getActionLabel(log.action)}</div>
                      <div className="text-xs text-[#9CA3AF]">
                        {formatDistanceToNow(new Date(log.timestamp!), { addSuffix: true, locale: fr })}
                        {log.manche && ` • Manche ${log.manche}`}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {isExpanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
                
                {renderDetailsSummary(log.action, details)}
                
                {isExpanded && renderExpandedDetails(log.action, details)}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
