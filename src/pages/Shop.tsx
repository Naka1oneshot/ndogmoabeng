import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useShopProducts, type ShopProduct } from '@/hooks/useShopProducts';
import { ProductCard } from '@/components/shop/ProductCard';
import { ProductEditModal } from '@/components/shop/ProductEditModal';
import { ProductDetailModal } from '@/components/shop/ProductDetailModal';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { ForestButton } from '@/components/ui/ForestButton';
import { SEOHead } from '@/components/seo/SEOHead';
import { Plus, Store, Loader2, ShoppingBag } from 'lucide-react';

// Import product images
import tshirtVillageNoir from '@/assets/shop/tshirt-village-noir.png';
import tshirtVillageBlanc from '@/assets/shop/tshirt-village-blanc.png';
import tshirtVillageRouge from '@/assets/shop/tshirt-village-rouge.png';
import tshirtInfectionNoir from '@/assets/shop/tshirt-infection-noir.png';

// Map for local images
const localImages: Record<string, string> = {
  'tshirt-village-noir': tshirtVillageNoir,
  'tshirt-village-blanc': tshirtVillageBlanc,
  'tshirt-village-rouge': tshirtVillageRouge,
  'tshirt-infection-noir': tshirtInfectionNoir,
};

export default function Shop() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useUserRole();
  const { products, isLoading, createProduct, updateProduct, deleteProduct } = useShopProducts();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);

  const canEdit = isAdmin || isSuperAdmin;

  const handleEdit = (product: ShopProduct) => {
    setSelectedProduct(product);
    setEditModalOpen(true);
  };

  const handleViewDetails = (product: ShopProduct) => {
    setSelectedProduct(product);
    setDetailModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedProduct(null);
    setEditModalOpen(true);
  };

  const handleSave = async (data: Partial<ShopProduct>) => {
    if (data.id) {
      await updateProduct.mutateAsync(data as Partial<ShopProduct> & { id: string });
    } else {
      await createProduct.mutateAsync(data);
    }
    setEditModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      await deleteProduct.mutateAsync(id);
      setEditModalOpen(false);
    }
  };

  // Get image URL, checking for local images first
  const getImageUrl = (product: ShopProduct) => {
    if (product.image_url) {
      // Check if it's a local image key
      if (localImages[product.image_url]) {
        return localImages[product.image_url];
      }
      return product.image_url;
    }
    return null;
  };

  return (
    <>
      <SEOHead
        title="Boutique | Le Village de Ndogmoabeng"
        description="Découvrez notre collection de t-shirts et produits dérivés officiels du Village de Ndogmoabeng."
      />
      
      <div className="min-h-screen bg-background">
        <LandingNavbar />
        
        <main className="container mx-auto px-4 pt-24 pb-16">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Store className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-display font-bold">Boutique</h1>
              </div>
              <p className="text-muted-foreground">
                Découvrez notre collection exclusive de produits Ndogmoabeng
              </p>
            </div>
            
            {canEdit && (
              <ForestButton onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau produit
              </ForestButton>
            )}
          </div>

          {/* Products grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Aucun produit disponible</h2>
              <p className="text-muted-foreground mb-6">
                La boutique sera bientôt remplie de produits exclusifs !
              </p>
              {canEdit && (
                <ForestButton onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter le premier produit
                </ForestButton>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{ ...product, image_url: getImageUrl(product) }}
                  isAdmin={canEdit}
                  onEdit={handleEdit}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          )}

          {/* Info section */}
          <div className="mt-16 p-6 rounded-xl bg-muted/50 border border-border">
            <h2 className="text-xl font-semibold mb-3">🚀 Bientôt disponible</h2>
            <p className="text-muted-foreground">
              Notre boutique en ligne sera bientôt opérationnelle avec un système de paiement sécurisé. 
              En attendant, vous pouvez acheter nos produits lors de nos événements meetup ou nous contacter directement.
            </p>
          </div>
        </main>

        <LandingFooter />
      </div>

      {/* Modals */}
      <ProductEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        product={selectedProduct}
        onSave={handleSave}
        onDelete={canEdit ? handleDelete : undefined}
        isLoading={createProduct.isPending || updateProduct.isPending || deleteProduct.isPending}
      />

      <ProductDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        product={selectedProduct ? { ...selectedProduct, image_url: getImageUrl(selectedProduct) } : null}
      />
    </>
  );
}
