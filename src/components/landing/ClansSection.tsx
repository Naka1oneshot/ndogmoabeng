import { Card, CardContent } from '@/components/ui/card';
import { CLANS_DATA } from '@/data/ndogmoabengData';
import { Crown, Coins, Compass, Shield, BookOpen, FlaskConical, Hammer } from 'lucide-react';

const clanIcons: Record<string, React.ElementType> = {
  'maison-royale': Crown,
  'fraternite-zoulous': Coins,
  'maison-keryndes': Compass,
  'akande': Shield,
  'cercle-aseyra': BookOpen,
  'sources-akila': FlaskConical,
  'ezkar': Hammer,
};

const clanColors: Record<string, string> = {
  'maison-royale': 'from-amber-500/20 to-amber-600/10',
  'fraternite-zoulous': 'from-emerald-500/20 to-emerald-600/10',
  'maison-keryndes': 'from-blue-500/20 to-blue-600/10',
  'akande': 'from-red-500/20 to-red-600/10',
  'cercle-aseyra': 'from-purple-500/20 to-purple-600/10',
  'sources-akila': 'from-cyan-500/20 to-cyan-600/10',
  'ezkar': 'from-orange-500/20 to-orange-600/10',
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
            const Icon = clanIcons[clan.id] || Crown;
            const colorClass = clanColors[clan.id] || 'from-primary/20 to-accent/10';

            return (
              <Card 
                key={clan.id} 
                className="card-gradient border-border/50 hover:border-primary/30 transition-all group overflow-hidden"
              >
                {/* Image/Icon placeholder */}
                <div className={`aspect-[4/3] bg-gradient-to-br ${colorClass} flex items-center justify-center relative`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                  <Icon className="w-16 h-16 text-foreground/60 group-hover:scale-110 transition-transform relative z-10" />
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
