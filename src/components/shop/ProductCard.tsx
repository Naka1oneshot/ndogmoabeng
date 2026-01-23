import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ForestButton } from '@/components/ui/ForestButton';
import { ShoppingCart, Eye, Edit } from 'lucide-react';
import type { ShopProduct } from '@/hooks/useShopProducts';

interface ProductCardProps {
  product: ShopProduct;
  isAdmin?: boolean;
  onEdit?: (product: ShopProduct) => void;
  onViewDetails?: (product: ShopProduct) => void;
}

export function ProductCard({ product, isAdmin, onEdit, onViewDetails }: ProductCardProps) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            Pas d'image
          </div>
        )}
        
        {/* Stock badge */}
        {product.stock !== null && product.stock <= 0 && (
          <Badge variant="destructive" className="absolute top-3 right-3">
            Rupture de stock
          </Badge>
        )}
        
        {/* Admin edit button */}
        {isAdmin && onEdit && (
          <button
            onClick={() => onEdit(product)}
            className="absolute top-3 left-3 p-2 bg-background/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
      </div>
      
      <CardContent className="p-4 space-y-3">
        <div>
          <Badge variant="outline" className="mb-2 text-xs">
            {product.category || 'T-Shirt'}
          </Badge>
          <h3 className="font-semibold text-lg line-clamp-1">{product.name}</h3>
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {product.description}
            </p>
          )}
        </div>
        
        {/* Sizes */}
        {product.sizes && product.sizes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.sizes.map((size) => (
              <span
                key={size}
                className="text-xs px-2 py-0.5 bg-muted rounded"
              >
                {size}
              </span>
            ))}
          </div>
        )}
        
        {/* Colors */}
        {product.colors && product.colors.length > 0 && (
          <div className="flex gap-1">
            {product.colors.map((color) => (
              <span
                key={color}
                className="text-xs px-2 py-0.5 bg-muted rounded"
              >
                {color}
              </span>
            ))}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xl font-bold text-primary">
            {product.price_eur.toFixed(2)} €
          </span>
          
          <div className="flex gap-2">
            <ForestButton
              variant="outline"
              size="sm"
              onClick={() => onViewDetails?.(product)}
            >
              <Eye className="h-4 w-4" />
            </ForestButton>
            <ForestButton
              size="sm"
              disabled={product.stock !== null && product.stock <= 0}
            >
              <ShoppingCart className="h-4 w-4" />
            </ForestButton>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
