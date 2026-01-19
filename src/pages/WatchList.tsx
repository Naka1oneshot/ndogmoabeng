import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWatchGames } from '@/hooks/useWatchGames';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { 
  Eye, 
  Search, 
  Users, 
  Gamepad2, 
  Clock, 
  ArrowLeft,
  Tv,
  Hash
} from 'lucide-react';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { Link } from 'react-router-dom';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  LOBBY: { label: 'En attente', variant: 'secondary' },
  IN_GAME: { label: 'En cours', variant: 'default' },
  RUNNING: { label: 'En cours', variant: 'default' },
};

const phaseLabels: Record<string, string> = {
  PHASE1_MISES: 'Phase 1 - Mises',
  PHASE2_POSITIONS: 'Phase 2 - Positions',
  COMBAT: 'Combat',
  SHOP: 'Boutique',
  RESULTS: 'Résultats',
};

export default function WatchList() {
  const navigate = useNavigate();
  const [searchName, setSearchName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const { games, loading, error } = useWatchGames(searchName);

  const handleCodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionCode.trim()) {
      // Navigate to spectator page with code lookup
      // For now, we'll just search by name
      setSearchName(sessionCode.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-10 h-10 object-contain" />
                <span className="font-display text-lg hidden sm:block">Ndogmoabeng</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <ForestButton variant="ghost" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4" />
                Retour
              </ForestButton>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Tv className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl text-glow mb-2">
            Regarder une partie
          </h1>
          <p className="text-muted-foreground">
            Suivez les parties en cours en mode spectateur
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-8 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher par nom de partie..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="pl-10"
            />
          </div>

          <form onSubmit={handleCodeSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Ou entrer un code de session (optionnel)"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                className="pl-10 uppercase tracking-widest"
                maxLength={6}
              />
            </div>
            <ForestButton type="submit" variant="secondary" disabled={!sessionCode.trim()}>
              Rechercher
            </ForestButton>
          </form>
        </div>

        {/* Games list */}
        {loading ? (
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="card-gradient border-border/50 animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-6 bg-muted rounded w-24 mb-2" />
                    <div className="h-5 bg-muted rounded w-32" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full mb-4" />
                    <div className="h-10 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : error ? (
          <Card className="card-gradient border-border/50 max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : games.length === 0 ? (
          <Card className="card-gradient border-border/50 max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <Tv className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-display text-xl mb-2">
                Aucune partie en cours
              </h3>
              <p className="text-muted-foreground mb-6">
                Aucune partie n'est disponible pour le moment.
              </p>
              <ForestButton onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4" />
                Retour à l'accueil
              </ForestButton>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <p className="text-muted-foreground">
                {games.length} partie{games.length > 1 ? 's' : ''} disponible{games.length > 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game) => (
                <Card 
                  key={game.game_id}
                  className="card-gradient border-border/50 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant={statusLabels[game.status]?.variant || 'outline'}>
                        <Clock className="w-3 h-3 mr-1" />
                        {statusLabels[game.status]?.label || game.status}
                      </Badge>
                      {game.mode === 'ADVENTURE' && (
                        <Badge variant="outline">
                          Aventure
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="font-display text-lg">
                      {game.name}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Gamepad2 className="w-4 h-4" />
                        <span>{game.game_type_name}</span>
                        {game.mode === 'ADVENTURE' && (
                          <span className="text-xs">
                            (Étape {game.current_step_index + 1})
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>{game.player_count} joueur{game.player_count > 1 ? 's' : ''}</span>
                        </div>
                        {game.manche_active && (
                          <span className="text-xs text-muted-foreground">
                            Manche {game.manche_active}
                          </span>
                        )}
                      </div>

                      {game.phase && (
                        <div className="text-xs text-muted-foreground">
                          {phaseLabels[game.phase] || game.phase}
                        </div>
                      )}
                    </div>

                    <ForestButton 
                      className="w-full"
                      onClick={() => navigate(`/watch/${game.game_id}`)}
                    >
                      <Eye className="w-4 h-4" />
                      Regarder
                    </ForestButton>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Mode Spectateur — Informations publiques uniquement</p>
        </div>
      </main>
    </div>
  );
}
