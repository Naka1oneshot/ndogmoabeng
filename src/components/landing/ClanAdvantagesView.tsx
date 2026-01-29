import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, ChevronUp, Sparkles, Info, Gamepad2, Grid3X3, List, Settings } from 'lucide-react';
import { CLANS_DATA } from '@/data/ndogmoabengData';
import { useClanAdvantages } from '@/hooks/useClanAdvantages';
import { useGameTypes } from '@/hooks/useGameTypes';
import { useUserRole } from '@/hooks/useUserRole';
import { ClanAdvantagesMatrix } from './ClanAdvantagesMatrix';
import { ClanAdvantagesAdminEditor } from './ClanAdvantagesAdminEditor';
import { Skeleton } from '@/components/ui/skeleton';
import type { ClanId } from '@/lib/clanAdvantages/types';

// Import clan images
import maisonRoyaleImg from '@/assets/clans/maison-royale.png';
import fraterniteZoulousImg from '@/assets/clans/fraternite-zoulous.png';
import maisonKeryndesImg from '@/assets/clans/maison-keryndes.png';
import akandeImg from '@/assets/clans/akande.png';
import cercleAseyraImg from '@/assets/clans/cercle-aseyra.png';
import sourcesAkilaImg from '@/assets/clans/sources-akila.png';
import ezkarImg from '@/assets/clans/ezkar.png';

const clanImages: Record<string, string> = {
  'maison-royale': maisonRoyaleImg,
  'fraternite-zoulous': fraterniteZoulousImg,
  'maison-keryndes': maisonKeryndesImg,
  'akande': akandeImg,
  'cercle-aseyra': cercleAseyraImg,
  'sources-akila': sourcesAkilaImg,
  'ezkar': ezkarImg,
};

type ViewMode = 'list' | 'matrix' | 'admin';

interface ClanAdvantagesViewProps {
  onClanClick?: (clanId: ClanId) => void;
}

export function ClanAdvantagesView({ onClanClick }: ClanAdvantagesViewProps) {
  const [selectedGame, setSelectedGame] = useState<string>('FORET');
  const [expandedClan, setExpandedClan] = useState<ClanId | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  const { advantages, loading, getAdvantagesByGame, clanHasAdvantageInGame } = useClanAdvantages();
  const { gameTypes, loading: loadingGames } = useGameTypes();
  const { isAdminOrSuper } = useUserRole();

  // Get advantages for the selected game
  const currentGameAdvantages = useMemo(() => {
    const byGame = getAdvantagesByGame();
    return byGame[selectedGame] || null;
  }, [getAdvantagesByGame, selectedGame]);

  // Check if game has any advantages
  const gameHasAdvantages = (gameCode: string): boolean => {
    return advantages.some(a => a.game_code === gameCode);
  };

  const currentGameName = gameTypes.find(g => g.code === selectedGame)?.name || selectedGame;
  const hasAdvantages = gameHasAdvantages(selectedGame);

  if (loading || loadingGames) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View mode tabs + Game selector */}
      <div className="flex flex-col gap-4">
        {/* View mode toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="list" className="gap-1">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Liste</span>
              </TabsTrigger>
              <TabsTrigger value="matrix" className="gap-1">
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Matrice</span>
              </TabsTrigger>
              {isAdminOrSuper && (
                <TabsTrigger value="admin" className="gap-1">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {viewMode === 'list' && (
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedGame} onValueChange={setSelectedGame}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sélectionner un jeu" />
                </SelectTrigger>
                <SelectContent>
                  {gameTypes.map((game) => (
                    <SelectItem key={game.code} value={game.code}>
                      {game.name}
                      {!gameHasAdvantages(game.code) && (
                        <span className="ml-2 text-muted-foreground text-xs">(aucun)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Matrix view */}
      {viewMode === 'matrix' && <ClanAdvantagesMatrix />}

      {/* Admin view */}
      {viewMode === 'admin' && isAdminOrSuper && <ClanAdvantagesAdminEditor />}

      {/* List view */}
      {viewMode === 'list' && (
        <>
          {/* No advantages message */}
          {!hasAdvantages && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8 px-4 rounded-lg border border-border bg-muted/30"
            >
              <Info className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">
                Aucun avantage de clan actif dans <strong>{currentGameName}</strong>
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Tous les clans jouent à égalité dans ce jeu.
              </p>
            </motion.div>
          )}

          {/* Clan cards grid */}
          {hasAdvantages && (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedGame}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {CLANS_DATA.map((clan) => {
                  const clanId = clan.id as ClanId;
                  const clanImage = clanImages[clanId];
                  const clanAdvantages = currentGameAdvantages?.[clanId] || [];
                  const hasAdvantagesInGame = clanAdvantages.length > 0;
                  const isExpanded = expandedClan === clanId;

                  return (
                    <motion.div
                      key={clanId}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card 
                        className={`card-gradient border-border/50 transition-all overflow-hidden ${
                          hasAdvantagesInGame 
                            ? 'hover:border-primary/30 cursor-pointer' 
                            : 'opacity-60'
                        }`}
                        onClick={() => hasAdvantagesInGame && setExpandedClan(isExpanded ? null : clanId)}
                      >
                        <CardHeader className="p-3 pb-2">
                          <div className="flex items-center gap-3">
                            <img 
                              src={clanImage} 
                              alt={clan.name}
                              className="w-10 h-10 object-contain"
                            />
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-sm font-medium truncate">
                                {clan.name}
                              </CardTitle>
                              {hasAdvantagesInGame ? (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  {clanAdvantages.length} avantage{clanAdvantages.length > 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Aucun avantage
                                </p>
                              )}
                            </div>
                            {hasAdvantagesInGame && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </CardHeader>

                        <AnimatePresence>
                          {isExpanded && hasAdvantagesInGame && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <CardContent className="p-3 pt-0 space-y-2">
                                {clanAdvantages.map((adv, idx) => (
                                  <div 
                                    key={idx}
                                    className="p-2 rounded bg-primary/5 border border-primary/10"
                                  >
                                    <p className="text-sm font-medium text-primary">
                                      {adv.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {adv.description}
                                    </p>
                                  </div>
                                ))}
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Note about advantages */}
          <p className="text-xs text-center text-muted-foreground">
            Les avantages sont gérés par les administrateurs.
          </p>
        </>
      )}
    </div>
  );
}
