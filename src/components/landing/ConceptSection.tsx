import { Card, CardContent } from '@/components/ui/card';
import { LORE } from '@/data/ndogmoabengData';
import { BookOpen, Eye, Shield, Compass, Brain } from 'lucide-react';
import villageImage from '@/assets/games/village-ndogmoabeng.png';

const icons = [BookOpen, Eye, Shield, Compass, Brain];

export function ConceptSection() {
  return (
    <section id="concept" className="py-20 scroll-mt-20">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Village illustration */}
          <div className="order-2 md:order-1">
            <Card className="overflow-hidden border-border/50">
              <img 
                src={villageImage} 
                alt="Village de Ndogmoabeng" 
                className="w-full aspect-square object-cover"
              />
            </Card>
          </div>

          {/* Right: Content */}
          <div className="order-1 md:order-2">
            <h2 className="font-display text-3xl md:text-4xl text-glow mb-4">
              {LORE.title}
            </h2>
            <p className="text-lg text-primary/80 mb-8">
              {LORE.subtitle}
            </p>

            <div className="space-y-4">
              {LORE.description.map((item, index) => {
                const Icon = icons[index % icons.length];
                return (
                  <Card key={index} className="card-gradient border-border/30">
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <p className="text-foreground/90 pt-2">
                        {item}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
