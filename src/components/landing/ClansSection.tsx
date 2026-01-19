import { Card, CardContent } from '@/components/ui/card';
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

export function ClansSection() {
  return (
    <section id="clans" className="py-20 scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl text-glow mb-4">
            Les Clans
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Sept clans aux visions différentes, tous liés par le village de Ndogmoabeng
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {CLANS_DATA.map((clan) => {
            const clanImage = clanImages[clan.id];

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
                  <p className="text-xs text-primary italic border-l-2 border-primary/50 pl-3">
                    "{clan.devise}"
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
