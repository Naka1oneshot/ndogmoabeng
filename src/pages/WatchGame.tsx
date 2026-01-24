import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSpectatorFeed, FeedEntry } from '@/hooks/useSpectatorFeed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Eye, 
  ArrowLeft,
  Users,
  Gamepad2,
  Clock,
  MessageSquare,
  Swords,
  Waves,
  AlertTriangle,
  Info,
  User,
  ChevronDown,
  ChevronRight,
  Tv,
  EyeOff
} from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PresentationModeView } from '@/components/mj/presentation/PresentationModeView';
import { RivieresPresentationView } from '@/components/rivieres/presentation/RivieresPresentationView';
import { InfectionPresentationView } from '@/components/infection/presentation/InfectionPresentationView';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  LOBBY: { label: 'En attente', variant: 'secondary' },
  IN_GAME: { label: 'En cours', variant: 'default' },
  RUNNING: { label: 'En cours', variant: 'default' },
  ENDED: { label: 'Terminée', variant: 'outline' },
  FINISHED: { label: 'Terminée', variant: 'outline' },
};

const sourceIcons: Record<string, React.ReactNode> = {
  LOG_JOUEUR: <MessageSquare className="w-4 h-4" />,
  SESSION_EVENT: <Info className="w-4 h-4" />,
  GAME_EVENT: <AlertTriangle className="w-4 h-4" />,
  COMBAT_RESULT: <Swords className="w-4 h-4" />,
  RIVER_RESULT: <Waves className="w-4 h-4" />,
};

const sourceLabels: Record<string, string> = {
  LOG_JOUEUR: 'Message',
  SESSION_EVENT: 'Événement',
  GAME_EVENT: 'Annonce',
  COMBAT_RESULT: 'Combat',
  RIVER_RESULT: 'Rivière',
};

// Get theme accent color based on game type
function getGameAccentClass(gameTypeCode: string | null): string {
  switch (gameTypeCode) {
    case 'RIVIERES':
      return 'border-sky-500/30 shadow-sky-500/10';
    case 'FORET':
      return 'border-green-500/30 shadow-green-500/10';
    case 'INFECTION':
      return 'border-lime-400/30 shadow-lime-400/10';
    default:
      return 'border-primary/30 shadow-primary/10';
  }
}

function getGameBadgeClass(gameTypeCode: string | null): string {
  switch (gameTypeCode) {
    case 'RIVIERES':
      return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    case 'FORET':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'INFECTION':
      return 'bg-lime-400/20 text-lime-400 border-lime-400/30';
    default:
      return '';
  }
}

export default function WatchGame() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { feed, gameInfo, participants, loading, error } = useSpectatorFeed(gameId);
  const [hideNames, setHideNames] = useState(false);
  const [expandedManches, setExpandedManches] = useState<Set<number>>(new Set([1]));

  // Group feed by manche
  const groupedFeed = useMemo(() => {
    const groups: Record<number, FeedEntry[]> = {};
    const noManche: FeedEntry[] = [];

    feed.forEach((entry) => {
      if (entry.manche !== null && entry.manche !== undefined) {
        if (!groups[entry.manche]) {
          groups[entry.manche] = [];
        }
        groups[entry.manche].push(entry);
      } else {
        noManche.push(entry);
      }
    });

    // Sort entries within each group by timestamp
    Object.keys(groups).forEach((key) => {
      groups[Number(key)].sort((a, b) => 
        new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
      );
    });

    return { groups, noManche };
  }, [feed]);

  const toggleManche = (manche: number) => {
    setExpandedManches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(manche)) {
        newSet.delete(manche);
      } else {
        newSet.add(manche);
      }
      return newSet;
    });
  };

  const formatMessage = (message: string) => {
    if (hideNames && participants.length > 0) {
      let formattedMessage = message;
      participants.forEach((p) => {
        if (p.display_name) {
          const regex = new RegExp(p.display_name, 'gi');
          formattedMessage = formattedMessage.replace(regex, `Joueur #${p.player_number || '?'}`);
        }
      });
      return formattedMessage;
    }
    return message;
  };

  const accentClass = getGameAccentClass(gameInfo?.game_type_code || null);
  const badgeClass = getGameBadgeClass(gameInfo?.game_type_code || null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de la partie...</p>
        </div>
      </div>
    );
  }

  if (error || !gameInfo) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3">
                <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-10 h-10 object-contain" />
                <span className="font-display text-lg hidden sm:block">Ndogmoabeng</span>
              </Link>
              <ForestButton variant="ghost" onClick={() => navigate('/watch')}>
                <ArrowLeft className="w-4 h-4" />
                Retour
              </ForestButton>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <Card className="card-gradient border-border/50 max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h3 className="font-display text-xl mb-2">Partie introuvable</h3>
              <p className="text-muted-foreground mb-6">
                {error || 'Cette partie n\'existe pas ou n\'est plus disponible.'}
              </p>
              <ForestButton onClick={() => navigate('/watch')}>
                <ArrowLeft className="w-4 h-4" />
                Retour à la liste
              </ForestButton>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // For Forest games, use Presentation Mode as the spectator view
  if (gameInfo.game_type_code === 'FORET') {
    const presentationGame = {
      id: gameInfo.game_id,
      name: gameInfo.name,
      status: gameInfo.status || 'RUNNING',
      manche_active: gameInfo.manche_active || 1,
      phase: gameInfo.phase || 'PHASE1_MISES',
      phase_locked: false,
      current_session_game_id: gameInfo.current_session_game_id,
    };
    
    return (
      <PresentationModeView 
        game={presentationGame} 
        onClose={() => navigate('/watch')} 
      />
    );
  }

  // For Rivieres games, use Rivieres Presentation Mode as the spectator view
  if (gameInfo.game_type_code === 'RIVIERES') {
    const rivieresGame = {
      id: gameInfo.game_id,
      name: gameInfo.name,
      status: gameInfo.status,
      current_session_game_id: gameInfo.current_session_game_id,
    };
    
    return (
      <RivieresPresentationView 
        game={rivieresGame}
        onClose={() => navigate('/watch')} 
      />
    );
  }

  // For Infection games, use Infection Presentation Mode as the spectator view
  if (gameInfo.game_type_code === 'INFECTION') {
    const infectionGame = {
      id: gameInfo.game_id,
      name: gameInfo.name,
      status: gameInfo.status,
      phase: gameInfo.phase || 'PLAYING',
      phase_locked: false,
      manche_active: gameInfo.manche_active || 1,
      selected_game_type_code: 'INFECTION',
      current_session_game_id: gameInfo.current_session_game_id,
    };
    
    return (
      <InfectionPresentationView 
        game={infectionGame}
        onClose={() => navigate('/watch')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link to="/" className="flex-shrink-0">
                <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-8 h-8 object-contain" />
              </Link>
              <div className="min-w-0">
                <h1 className="font-display text-lg truncate">{gameInfo.name}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Gamepad2 className="w-3 h-3" />
                  <span className="truncate">{gameInfo.game_type_name}</span>
                  {gameInfo.mode === 'ADVENTURE' && (
                    <span className="text-xs">(Étape {gameInfo.current_step_index + 1})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={statusLabels[gameInfo.status]?.variant || 'outline'}>
                <Clock className="w-3 h-3 mr-1" />
                {statusLabels[gameInfo.status]?.label || gameInfo.status}
              </Badge>
              {gameInfo.manche_active && (
                <Badge variant="outline">
                  M{gameInfo.manche_active}
                </Badge>
              )}
              <Badge className={cn("border", badgeClass || "bg-primary/20 text-primary border-primary/30")}>
                <Eye className="w-3 h-3 mr-1" />
                Spectateur
              </Badge>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main content - Chronique */}
          <div className="lg:col-span-3 space-y-4">
            {gameInfo.is_ended && (
              <Card className="card-gradient border-border/50 bg-muted/50">
                <CardContent className="py-4 text-center">
                  <p className="text-muted-foreground">
                    🏁 La partie est terminée — Chronique finale
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className={cn("card-gradient border-border/50 hover:shadow-lg transition-shadow", accentClass)}>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-xl flex items-center gap-2">
                  <Tv className="w-5 h-5" />
                  Chronique de la partie
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feed.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun événement public pour le moment.</p>
                    <p className="text-sm mt-2">Les événements apparaîtront ici en temps réel.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Events without manche */}
                    {groupedFeed.noManche.length > 0 && (
                      <div className="space-y-2">
                        {groupedFeed.noManche.map((entry) => (
                          <FeedEntryCard 
                            key={entry.entry_id} 
                            entry={entry}
                            formatMessage={formatMessage}
                          />
                        ))}
                      </div>
                    )}

                    {/* Grouped by manche */}
                    {Object.keys(groupedFeed.groups)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((manche) => (
                        <div key={manche} className="space-y-2">
                          <button
                            onClick={() => toggleManche(manche)}
                            className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg bg-surface-2/50 hover:bg-surface-2 transition-colors"
                          >
                            {expandedManches.has(manche) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <span className="font-display text-sm">Manche {manche}</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {groupedFeed.groups[manche].length} événement{groupedFeed.groups[manche].length > 1 ? 's' : ''}
                            </span>
                          </button>
                          
                          {expandedManches.has(manche) && (
                            <div className="space-y-2 pl-4 border-l-2 border-border ml-2">
                              {groupedFeed.groups[manche].map((entry) => (
                                <FeedEntryCard 
                                  key={entry.entry_id} 
                                  entry={entry}
                                  formatMessage={formatMessage}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Participants */}
          <div className="space-y-4">
            <Card className="card-gradient border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Toggle hide names */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="hide-names" className="text-sm flex items-center gap-2">
                    <EyeOff className="w-4 h-4" />
                    Masquer les noms
                  </Label>
                  <Switch
                    id="hide-names"
                    checked={hideNames}
                    onCheckedChange={setHideNames}
                  />
                </div>

                <Separator />

                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {participants.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucun joueur
                      </p>
                    ) : (
                      participants.map((p) => (
                        <div 
                          key={p.player_number}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg bg-surface-2/30",
                            p.is_alive === false && "opacity-50"
                          )}
                        >
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm truncate">
                            {hideNames ? `Joueur #${p.player_number || '?'}` : p.display_name}
                          </span>
                          {p.clan && !hideNames && (
                            <Badge variant="outline" className="text-xs ml-auto">
                              {p.clan}
                            </Badge>
                          )}
                          {p.is_alive === false && (
                            <span className="text-xs text-destructive ml-auto">☠️</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                <div className="text-xs text-muted-foreground text-center pt-2">
                  {gameInfo.player_count} joueur{gameInfo.player_count > 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <ForestButton 
              variant="secondary" 
              className="w-full"
              onClick={() => navigate('/watch')}
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la liste
            </ForestButton>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Mode Spectateur — Informations publiques uniquement</p>
        </div>
      </div>
    </div>
  );
}

// Sub-component for feed entries
function FeedEntryCard({ 
  entry, 
  formatMessage 
}: { 
  entry: FeedEntry; 
  formatMessage: (msg: string) => string;
}) {
  const icon = sourceIcons[entry.source_type] || <Info className="w-4 h-4" />;
  const label = sourceLabels[entry.source_type] || 'Info';

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-surface/50 hover:bg-surface transition-colors">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-2/50 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {entry.phase_label && (
            <Badge variant="outline" className="text-xs">
              {entry.phase_label}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {format(new Date(entry.event_timestamp), 'HH:mm', { locale: fr })}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">
          {formatMessage(entry.message || '')}
        </p>
      </div>
    </div>
  );
}
