import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Gamepad2, Copy, ExternalLink, Check, RefreshCw, Map, Droplets, Swords, Bug, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActiveGameLink {
  id: string;
  game_id: string;
  reconnect_url: string;
  updated_at: string;
  game: {
    id: string;
    name: string;
    status: string;
    phase: string;
    mode: string;
    selected_game_type_code: string | null;
    current_step_index: number;
    adventure_id: string | null;
  } | null;
}

interface AdventureStep {
  step_index: number;
  game_type_code: string;
}

const GAME_TYPE_INFO: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  FORET: { label: 'La Forêt', icon: Swords, color: 'text-emerald-400' },
  RIVIERES: { label: 'Les Rivières', icon: Droplets, color: 'text-blue-400' },
  INFECTION: { label: 'Infection', icon: Bug, color: 'text-red-400' },
  SHERIFF: { label: 'Shérif', icon: Shield, color: 'text-amber-400' },
};

export function ActiveGamesSection() {
  const { user } = useAuth();
  const [gameLinks, setGameLinks] = useState<ActiveGameLink[]>([]);
  const [adventureSteps, setAdventureSteps] = useState<Record<string, AdventureStep[]>>({});
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGameLinks = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('player_reconnect_links')
        .select(`
          id,
          game_id,
          reconnect_url,
          updated_at,
          game:games (
            id,
            name,
            status,
            phase,
            mode,
            selected_game_type_code,
            current_step_index,
            adventure_id
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Filter to only show active games
      const activeLinks = ((data as unknown as ActiveGameLink[]) || []).filter(
        link => link.game && !['ENDED', 'FINISHED', 'ARCHIVED'].includes(link.game.status)
      );
      
      setGameLinks(activeLinks);

      // Fetch adventure steps for adventure mode games
      const adventureIds = activeLinks
        .filter(link => link.game?.mode === 'ADVENTURE' && link.game?.adventure_id)
        .map(link => link.game!.adventure_id!)
        .filter((id, idx, arr) => arr.indexOf(id) === idx);

      if (adventureIds.length > 0) {
        const { data: stepsData } = await supabase
          .from('adventure_steps')
          .select('adventure_id, step_index, game_type_code')
          .in('adventure_id', adventureIds)
          .order('step_index');

        if (stepsData) {
          const stepsMap: Record<string, AdventureStep[]> = {};
          stepsData.forEach(step => {
            if (!stepsMap[step.adventure_id]) {
              stepsMap[step.adventure_id] = [];
            }
            stepsMap[step.adventure_id].push({
              step_index: step.step_index,
              game_type_code: step.game_type_code,
            });
          });
          setAdventureSteps(stepsMap);
        }
      }
    } catch (error) {
      console.error('Error fetching game links:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameLinks();

    // Subscribe to changes
    if (user) {
      const channel = supabase
        .channel(`reconnect-links-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'player_reconnect_links',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchGameLinks();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const handleCopy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success('Lien copié dans le presse-papier');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank');
  };

  const getGameTypeDisplay = (game: ActiveGameLink['game']) => {
    if (!game) return null;
    
    const code = game.selected_game_type_code;
    const info = code ? GAME_TYPE_INFO[code] : null;
    
    if (!info) return null;
    
    const Icon = info.icon;
    return (
      <span className={`flex items-center gap-1 ${info.color}`}>
        <Icon className="w-3 h-3" />
        {info.label}
      </span>
    );
  };

  const getAdventureProgress = (game: ActiveGameLink['game']) => {
    if (!game || game.mode !== 'ADVENTURE' || !game.adventure_id) return null;
    
    const steps = adventureSteps[game.adventure_id];
    if (!steps || steps.length === 0) return null;
    
    const currentStepIndex = game.current_step_index;
    
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Map className="w-3 h-3" />
        <span>Aventure ({currentStepIndex}/{steps.length})</span>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LOBBY':
        return <Badge variant="secondary">En attente</Badge>;
      case 'IN_GAME':
      case 'RUNNING':
        return <Badge className="bg-primary/20 text-primary border-primary/30">En cours</Badge>;
      case 'IN_ROUND':
        return <Badge className="bg-secondary text-secondary-foreground border-secondary">Manche en cours</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5" />
              Mes parties en cours
            </CardTitle>
            <CardDescription>
              Liens de reconnexion pour vos parties actives
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchGameLinks}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {gameLinks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune partie en cours</p>
            <p className="text-sm mt-1">Les liens de reconnexion apparaîtront ici quand le MJ les génèrera</p>
          </div>
        ) : (
          <div className="space-y-3">
            {gameLinks.map((link) => (
              <div
                key={link.id}
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                {link.game ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold truncate">{link.game.name}</h4>
                        {getStatusBadge(link.game.status)}
                        {link.game.mode === 'ADVENTURE' && (
                          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                            <Map className="w-3 h-3 mr-1" />
                            Aventure
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
                        {getGameTypeDisplay(link.game)}
                        {link.game.mode === 'ADVENTURE' && getAdventureProgress(link.game)}
                        <span>•</span>
                        <span>Mis à jour {format(new Date(link.updated_at), 'dd/MM à HH:mm', { locale: fr })}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(link.id, link.reconnect_url)}
                        className="gap-2"
                      >
                        {copiedId === link.id ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Copier</span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenLink(link.reconnect_url)}
                        className="gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">Rejoindre</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Partie non trouvée</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
