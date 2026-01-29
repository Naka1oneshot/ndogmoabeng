import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Eye, Sparkles } from 'lucide-react';
import { CLANS_DATA } from '@/data/ndogmoabengData';
import { ClanAdvantagesView } from './ClanAdvantagesView';
import { ClanAdvantagesOverlay } from './ClanAdvantagesOverlay';
import { clanHasAnyAdvantages, type ClanId } from '@/lib/clanAdvantages/registry';

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

type ViewMode = 'clans' | 'advantages';

export function ClansSection() {
  const [viewMode, setViewMode] = useState<ViewMode>('clans');
  const [selectedClanForOverlay, setSelectedClanForOverlay] = useState<ClanId | null>(null);

  return (
    <section id="clans" className="py-20 scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl md:text-4xl text-glow mb-4">
            Les Clans
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Sept clans aux visions différentes, tous liés par le village de Ndogmoabeng
          </p>

          {/* Toggle tabs */}
          <Tabs 
            value={viewMode} 
            onValueChange={(v) => setViewMode(v as ViewMode)}
            className="inline-flex"
          >
            <TabsList className="grid w-full grid-cols-2 max-w-xs mx-auto">
              <TabsTrigger value="clans" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Vue Clans</span>
                <span className="sm:hidden">Clans</span>
              </TabsTrigger>
              <TabsTrigger value="advantages" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Avantages par jeu</span>
                <span className="sm:hidden">Avantages</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <AnimatePresence mode="wait">
          {viewMode === 'clans' ? (
            <motion.div
              key="clans"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {CLANS_DATA.map((clan) => {
                  const clanImage = clanImages[clan.id];
                  const clanId = clan.id as ClanId;
                  const hasAdvantages = clanHasAnyAdvantages(clanId);

                  return (
                    <Card 
                      key={clan.id} 
                      className="card-gradient border-border/50 hover:border-primary/30 transition-all group overflow-hidden"
                    >
                      {/* Clan emblem image */}
                      <div className="aspect-square bg-background/80 flex items-center justify-center p-6">
                        <img 
                          src={clanImage} 
                          alt={`Emblème du clan ${clan.name}`}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <CardContent className="p-4">
                        <h3 className="font-display text-lg mb-2">
                          {clan.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {clan.description}
                        </p>
                        <p className="text-xs text-primary italic border-l-2 border-primary/50 pl-3 mb-3">
                          "{clan.devise}"
                        </p>
                        
                        {hasAdvantages && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => setSelectedClanForOverlay(clanId)}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Voir les avantages
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="advantages"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ClanAdvantagesView onClanClick={setSelectedClanForOverlay} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Overlay for clan details */}
      <ClanAdvantagesOverlay
        clanId={selectedClanForOverlay}
        open={!!selectedClanForOverlay}
        onClose={() => setSelectedClanForOverlay(null)}
      />
    </section>
  );
}
