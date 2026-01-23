import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ForestButton } from '@/components/ui/ForestButton';
import { Loader2, Trash2 } from 'lucide-react';
import type { ShopProduct } from '@/hooks/useShopProducts';

interface ProductEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ShopProduct | null;
  onSave: (data: Partial<ShopProduct>) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
}

export function ProductEditModal({
  open,
  onOpenChange,
  product,
  onSave,
  onDelete,
  isLoading,
}: ProductEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_eur: 0,
    image_url: '',
    category: 'T-Shirt',
    sizes: 'S, M, L, XL, XXL',
    colors: '',
    stock: 0,
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price_eur: product.price_eur || 0,
        image_url: product.image_url || '',
        category: product.category || 'T-Shirt',
        sizes: product.sizes?.join(', ') || 'S, M, L, XL, XXL',
        colors: product.colors?.join(', ') || '',
        stock: product.stock || 0,
        is_active: product.is_active ?? true,
        sort_order: product.sort_order || 0,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        price_eur: 0,
        image_url: '',
        category: 'T-Shirt',
        sizes: 'S, M, L, XL, XXL',
        colors: '',
        stock: 0,
        is_active: true,
        sort_order: 0,
      });
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const sizesArray = formData.sizes
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    const colorsArray = formData.colors
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);

    onSave({
      ...(product && { id: product.id }),
      name: formData.name,
      description: formData.description || null,
      price_eur: Number(formData.price_eur),
      image_url: formData.image_url || null,
      category: formData.category,
      sizes: sizesArray,
      colors: colorsArray.length > 0 ? colorsArray : null,
      stock: Number(formData.stock),
      is_active: formData.is_active,
      sort_order: Number(formData.sort_order),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Modifier le produit' : 'Nouveau produit'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_eur">Prix (€) *</Label>
              <Input
                id="price_eur"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_eur}
                onChange={(e) => setFormData({ ...formData, price_eur: Number(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">URL de l'image</Label>
            <Input
              id="image_url"
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Catégorie</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sizes">Tailles (séparées par des virgules)</Label>
            <Input
              id="sizes"
              value={formData.sizes}
              onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
              placeholder="S, M, L, XL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="colors">Couleurs (séparées par des virgules)</Label>
            <Input
              id="colors"
              value={formData.colors}
              onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
              placeholder="Noir, Blanc, Rouge"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sort_order">Ordre d'affichage</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Actif</Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-4">
            {product && onDelete && (
              <ForestButton
                type="button"
                variant="destructive"
                onClick={() => onDelete(product.id)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </ForestButton>
            )}
            <ForestButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </ForestButton>
            <ForestButton type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {product ? 'Mettre à jour' : 'Créer'}
            </ForestButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
