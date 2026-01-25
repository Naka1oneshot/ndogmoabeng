import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Gamepad2, Copy, ExternalLink, Check, RefreshCw } from 'lucide-react';
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
    selected_game_type_code: string | null;
  } | null;
}

export function ActiveGamesSection() {
  const { user } = useAuth();
  const [gameLinks, setGameLinks] = useState<ActiveGameLink[]>([]);
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
            selected_game_type_code
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

  const getGameTypeName = (code: string | null) => {
    switch (code) {
      case 'FOREST': return 'La Forêt';
      case 'INFECTION': return 'Infection';
      case 'RIVIERES': return 'Les Rivières';
      case 'SHERIFF': return 'Sheriff';
      default: return 'Partie';
    }
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
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <span>{getGameTypeName(link.game.selected_game_type_code)}</span>
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
