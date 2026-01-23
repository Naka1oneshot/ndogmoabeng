import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

// Import local product images
import tshirtVillageNoir from '@/assets/shop/tshirt-village-noir.png';
import tshirtVillageBlanc from '@/assets/shop/tshirt-village-blanc.png';
import tshirtVillageRouge from '@/assets/shop/tshirt-village-rouge.png';
import tshirtInfectionNoir from '@/assets/shop/tshirt-infection-noir.png';

// Map image keys to imported assets
const imageMap: Record<string, string> = {
  'tshirt-village-noir': tshirtVillageNoir,
  'tshirt-village-blanc': tshirtVillageBlanc,
  'tshirt-village-rouge': tshirtVillageRouge,
  'tshirt-infection-noir': tshirtInfectionNoir,
};

// Helper function to resolve image URL
const getProductImage = (imageUrl: string | null): string | null => {
  if (!imageUrl) return null;
  // Check if it's a key in our local map
  const localImage = imageMap[imageUrl];
  if (localImage) return localImage;
  // Check if it contains a path to assets folder (legacy)
  if (imageUrl.includes('/assets/shop/')) {
    const filename = imageUrl.split('/').pop()?.replace('.png', '');
    if (filename && imageMap[filename]) return imageMap[filename];
  }
  // Otherwise return as-is (could be an external URL)
  return imageUrl;
};

export function ShopPreviewSection() {
  const navigate = useNavigate();

  const { data: products = [] } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data;
    },
  });

  if (products.length === 0) return null;

  return (
    <section id="boutique" className="py-16 md:py-24" aria-labelledby="shop-title">
      <div className="container mx-auto px-4">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm font-medium">Boutique Officielle</span>
          </div>
          <h2 id="shop-title" className="font-display text-3xl md:text-4xl mb-4">
            Nos Produits
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Découvrez notre collection exclusive de produits Ndogmoabeng. 
            T-shirts, accessoires et bien plus encore.
          </p>
        </header>

        {/* Products Carousel */}
        <div className="relative px-12">
          <Carousel
            opts={{
              align: 'start',
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {products.map((product) => (
                <CarouselItem key={product.id} className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                  <Card 
                    className="group cursor-pointer overflow-hidden border-border/50 hover:border-primary/50 transition-all duration-300"
                    onClick={() => navigate('/boutique')}
                  >
                    <div className="aspect-square overflow-hidden bg-muted/30">
                      {getProductImage(product.image_url) ? (
                        <img
                          src={getProductImage(product.image_url)!}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Plus que {product.stock}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">
                          {product.price_eur.toFixed(2)} €
                        </span>
                        <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                          Voir <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <ForestButton onClick={() => navigate('/boutique')} size="lg">
            <ShoppingBag className="h-4 w-4" />
            Voir toute la boutique
          </ForestButton>
        </div>
      </div>
    </section>
  );
}
