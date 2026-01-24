import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, Bot, Lock, Coins, ShieldCheck, 
  Pencil, Copy, Check, RefreshCw, UserX, Loader2, ExternalLink
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  clan: string | null;
  mate_num: number | null;
  jetons: number;
  recompenses?: number;
  pvic?: number;
  is_alive?: boolean;
  last_seen: string | null;
  joined_at: string;
  clan_locked?: boolean;
  clan_token_used?: boolean;
  is_bot?: boolean;
  player_token?: string | null;
  user_id?: string | null;
}

interface PlayerRowCompactProps {
  player: Player;
  index?: number;
  // Optional extra stats for Rivières
  validatedLevels?: number;
  // Adventure cumulative PVic (from adventure_scores)
  adventurePvic?: number;
  // Presence badge config
  presenceBadge?: { color: string; textColor: string; label: string };
  // Actions
  onEdit?: (player: Player) => void;
  onCopyLink?: (playerId: string) => void;
  onResetToken?: (playerId: string, playerName: string) => void;
  onKick?: (player: { id: string; name: string }) => void;
  // States
  copiedId?: string | null;
  resettingId?: string | null;
  // Theme variant
  variant?: 'forest' | 'rivieres' | 'infection';
}

const THEME_STYLES = {
  forest: {
    container: 'bg-card/50 border border-primary/20',
    number: 'bg-primary/20 text-primary',
    name: 'text-foreground',
    secondary: 'text-muted-foreground',
    accent: 'text-forest-gold',
    popoverBg: 'bg-card border-primary/30',
  },
  rivieres: {
    container: 'bg-[#20232A] border border-[#D4AF37]/10',
    number: 'bg-[#D4AF37]/20 text-[#D4AF37]',
    name: 'text-[#E8E8E8]',
    secondary: 'text-[#9CA3AF]',
    accent: 'text-[#4ADE80]',
    popoverBg: 'bg-[#1A2235] border-[#D4AF37]/30',
  },
  infection: {
    container: 'bg-[#1A2235] border border-[#D4AF37]/10',
    number: 'bg-[#D4AF37]/20 text-[#D4AF37]',
    name: 'text-[#E8E8E8]',
    secondary: 'text-[#9CA3AF]',
    accent: 'text-[#2AB3A6]',
    popoverBg: 'bg-[#0F1520] border-[#D4AF37]/30',
  },
};

export function PlayerRowCompact({
  player,
  validatedLevels,
  adventurePvic,
  presenceBadge,
  onEdit,
  onCopyLink,
  onResetToken,
  onKick,
  copiedId,
  resettingId,
  variant = 'forest',
}: PlayerRowCompactProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const navigate = useNavigate();
  const theme = THEME_STYLES[variant];
  
  // Calculate total PVic for display: adventure cumulative + current game points
  // NOTE: adventurePvic already contains pvic from previous games, only add recompenses (current game kills/rewards)
  const currentGamePvic = player.recompenses || 0;
  const totalPvic = adventurePvic !== undefined ? adventurePvic + currentGamePvic : undefined;

  const handleViewProfile = () => {
    if (player.user_id) {
      setPopoverOpen(false);
      navigate(`/profile/${player.user_id}`);
    }
  };

  const truncateName = (name: string, maxLen = 8) => {
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen) + '…';
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${theme.container}`}>
      {/* Player number */}
      <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${theme.number}`}>
        {player.player_number || '?'}
      </div>

      {/* Bot icon if applicable */}
      {player.is_bot && (
        <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
      )}

      {/* Truncated name */}
      <span className={`font-medium text-sm truncate min-w-0 flex-1 ${theme.name}`}>
        {truncateName(player.display_name, 10)}
      </span>

      {/* Clan badge (abbreviated) */}
      {player.clan && (
        <Badge variant="outline" className={`text-xs px-1.5 py-0 shrink-0 ${theme.secondary}`}>
          {player.clan.slice(0, 3)}
        </Badge>
      )}

      {/* Tokens */}
      <span className={`text-sm font-medium shrink-0 ${theme.accent}`}>
        {player.jetons}💎
      </span>

      {/* Adventure PVic cumulative */}
      {totalPvic !== undefined && (
        <span className="text-sm font-medium shrink-0 text-amber-500">
          {totalPvic}🏆
        </span>
      )}

      {/* Presence indicator (dot only) */}
      {presenceBadge && (
        <span className={`w-2 h-2 shrink-0 rounded-full ${presenceBadge.color}`} />
      )}

      {/* More button -> Popover with details */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className={`w-64 p-3 ${theme.popoverBg} z-50`} 
          align="end"
          sideOffset={4}
        >
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${theme.number}`}>
                {player.player_number || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-medium text-sm ${theme.name}`}>{player.display_name}</p>
                {player.is_bot && (
                  <span className={`text-xs ${theme.secondary}`}>🤖 Bot</span>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className={theme.secondary}>Clan:</span>
                <span className={`ml-1 ${theme.name}`}>
                  {player.clan || '-'}
                  {player.clan_locked && <Lock className="inline h-3 w-3 ml-0.5" />}
                  {player.clan_token_used && <Coins className="inline h-3 w-3 ml-0.5 text-yellow-500" />}
                </span>
              </div>
              <div>
                <span className={theme.secondary}>Mate:</span>
                <span className={`ml-1 ${theme.name}`}>{player.mate_num || '-'}</span>
              </div>
              <div>
                <span className={theme.secondary}>Jetons:</span>
                <span className={`ml-1 font-medium ${theme.accent}`}>{player.jetons}💎</span>
              </div>
              {totalPvic !== undefined && (
                <div>
                  <span className={theme.secondary}>PVic:</span>
                  <span className="ml-1 font-medium text-amber-500">{totalPvic}🏆</span>
                </div>
              )}
              {validatedLevels !== undefined && (
                <div>
                  <span className={theme.secondary}>Niveaux:</span>
                  <span className={`ml-1 ${theme.name}`}>{validatedLevels}/15</span>
                </div>
              )}
              <div className="col-span-2">
                <span className={theme.secondary}>Rejoint:</span>
                <span className={`ml-1 ${theme.name}`}>
                  {formatDistanceToNow(new Date(player.joined_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
              {presenceBadge && (
                <div className="col-span-2 flex items-center gap-1">
                  <span className={theme.secondary}>Statut:</span>
                  <span className={`w-2 h-2 rounded-full ${presenceBadge.color}`} />
                  <span className={presenceBadge.textColor}>{presenceBadge.label}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-1 pt-2 border-t border-border/30">
              {player.user_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewProfile}
                  className="h-7 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Voir profil
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onEdit(player); setPopoverOpen(false); }}
                  className="h-7 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Modifier
                </Button>
              )}
              {onCopyLink && player.player_token && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyLink(player.id)}
                  className="h-7 text-xs"
                >
                  {copiedId === player.id ? (
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 mr-1" />
                  )}
                  Lien
                </Button>
              )}
              {onResetToken && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onResetToken(player.id, player.display_name)}
                  disabled={resettingId === player.id}
                  className="h-7 text-xs"
                >
                  {resettingId === player.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Token
                </Button>
              )}
              {onKick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onKick({ id: player.id, name: player.display_name }); setPopoverOpen(false); }}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <UserX className="h-3 w-3 mr-1" />
                  Exclure
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
