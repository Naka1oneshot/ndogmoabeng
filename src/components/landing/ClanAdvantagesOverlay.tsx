import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Gamepad2 } from 'lucide-react';
import { getAdvantagesByClan, type ClanId } from '@/lib/clanAdvantages/registry';
import { CLANS_DATA } from '@/data/ndogmoabengData';

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

interface ClanAdvantagesOverlayProps {
  clanId: ClanId | null;
  open: boolean;
  onClose: () => void;
}

export function ClanAdvantagesOverlay({ clanId, open, onClose }: ClanAdvantagesOverlayProps) {
  if (!clanId) return null;

  const clan = CLANS_DATA.find((c) => c.id === clanId);
  const advantagesByGame = getAdvantagesByClan(clanId);
  const clanImage = clanImages[clanId];
  const hasAnyAdvantages = advantagesByGame.length > 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <img 
              src={clanImage} 
              alt={clan?.name}
              className="w-16 h-16 object-contain"
            />
            <div>
              <DialogTitle className="text-xl">{clan?.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {clan?.description}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            Avantages par jeu
          </h3>

          {!hasAnyAdvantages ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-6 px-4 rounded-lg border border-border bg-muted/30"
            >
              <p className="text-muted-foreground">
                Ce clan n'a pas d'avantages spécifiques dans les jeux actuels.
              </p>
            </motion.div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {advantagesByGame.map((game) => (
                <AccordionItem key={game.gameCode} value={game.gameCode}>
                  <AccordionTrigger className="py-3">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-4 w-4 text-primary" />
                      <span>{game.gameName}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {game.advantages.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-6">
                      {game.advantages.map((adv, idx) => (
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
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {clan?.devise && (
          <p className="text-xs text-primary italic border-l-2 border-primary/50 pl-3 mt-4">
            "{clan.devise}"
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
