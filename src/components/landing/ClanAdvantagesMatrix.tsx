import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { CLANS_DATA } from '@/data/ndogmoabengData';
import { useClanAdvantages } from '@/hooks/useClanAdvantages';
import { useGameTypes } from '@/hooks/useGameTypes';
import type { ClanId } from '@/lib/clanAdvantages/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

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

export function ClanAdvantagesMatrix() {
  const { advantages, loading, clanHasAdvantageInGame, getAdvantagesByGame } = useClanAdvantages();
  const { gameTypes, loading: loadingGames } = useGameTypes();

  if (loading || loadingGames) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Get all unique game codes from advantages + active game types
  const allGameCodes = Array.from(new Set([
    ...advantages.map(a => a.game_code),
    ...gameTypes.map(g => g.code),
  ])).sort();

  const gameNameMap: Record<string, string> = {};
  for (const g of gameTypes) {
    gameNameMap[g.code] = g.name;
  }

  const advantagesByGame = getAdvantagesByGame();

  // Get advantage count for tooltip
  const getAdvantageCount = (gameCode: string, clanId: string): number => {
    const gameAdvantages = advantagesByGame[gameCode];
    if (!gameAdvantages) return 0;
    return gameAdvantages[clanId as ClanId]?.length || 0;
  };

  // Get advantages list for tooltip
  const getAdvantagesList = (gameCode: string, clanId: string): string[] => {
    const gameAdvantages = advantagesByGame[gameCode];
    if (!gameAdvantages) return [];
    return gameAdvantages[clanId as ClanId]?.map(a => a.title) || [];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-x-auto"
    >
      <TooltipProvider delayDuration={200}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px] sticky left-0 bg-background z-10">Clan</TableHead>
              {allGameCodes.map((gameCode) => (
                <TableHead key={gameCode} className="text-center min-w-[80px]">
                  <span className="text-xs">{gameNameMap[gameCode] || gameCode}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {CLANS_DATA.map((clan) => {
              const clanId = clan.id as ClanId;
              const clanImage = clanImages[clanId];

              return (
                <TableRow key={clanId}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <div className="flex items-center gap-2">
                      <img
                        src={clanImage}
                        alt={clan.name}
                        className="w-6 h-6 object-contain"
                      />
                      <span className="text-xs font-medium truncate max-w-[100px]">
                        {clan.name}
                      </span>
                    </div>
                  </TableCell>
                  {allGameCodes.map((gameCode) => {
                    const hasAdvantage = clanHasAdvantageInGame(gameCode, clanId);
                    const count = getAdvantageCount(gameCode, clanId);
                    const advantageList = getAdvantagesList(gameCode, clanId);

                    return (
                      <TableCell key={gameCode} className="text-center">
                        {hasAdvantage ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center justify-center"
                              >
                                <Star className="h-4 w-4 fill-primary text-primary" />
                                {count > 1 && (
                                  <span className="text-[10px] text-primary ml-0.5">
                                    ×{count}
                                  </span>
                                )}
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]">
                              <p className="font-medium text-xs mb-1">
                                {count} avantage{count > 1 ? 's' : ''}
                              </p>
                              <ul className="text-xs text-muted-foreground space-y-0.5">
                                {advantageList.map((title, i) => (
                                  <li key={i}>• {title}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TooltipProvider>

      <p className="text-xs text-center text-muted-foreground mt-4">
        ★ indique un ou plusieurs avantages actifs • Survolez pour voir les détails
      </p>
    </motion.div>
  );
}
