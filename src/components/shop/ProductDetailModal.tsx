import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ForestButton } from '@/components/ui/ForestButton';
import { ShoppingCart, Minus, Plus } from 'lucide-react';
import type { ShopProduct } from '@/hooks/useShopProducts';

interface ProductDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ShopProduct | null;
}

export function ProductDetailModal({ open, onOpenChange, product }: ProductDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const isOutOfStock = product.stock !== null && product.stock <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image */}
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                Pas d'image
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div>
              <Badge variant="outline" className="mb-2">
                {product.category || 'T-Shirt'}
              </Badge>
              <h2 className="text-2xl font-bold">{product.name}</h2>
              {product.description && (
                <p className="text-muted-foreground mt-2">{product.description}</p>
              )}
            </div>

            <div className="text-3xl font-bold text-primary">
              {product.price_eur.toFixed(2)} €
            </div>

            {/* Size selection */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Taille</label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`px-4 py-2 border rounded-md transition-colors ${
                        selectedSize === size
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color selection */}
            {product.colors && product.colors.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 border rounded-md transition-colors ${
                        selectedColor === color
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantité</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 border rounded-md hover:bg-muted"
                  disabled={isOutOfStock}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 border rounded-md hover:bg-muted"
                  disabled={isOutOfStock}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Stock info */}
            {product.stock !== null && (
              <p className={`text-sm ${isOutOfStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                {isOutOfStock ? 'Rupture de stock' : `${product.stock} en stock`}
              </p>
            )}

            {/* Add to cart */}
            <ForestButton
              className="w-full"
              size="lg"
              disabled={isOutOfStock}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {isOutOfStock ? 'Indisponible' : 'Ajouter au panier'}
            </ForestButton>

            <p className="text-xs text-muted-foreground text-center">
              Bientôt disponible à l'achat ! Connectez-vous pour être notifié.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
