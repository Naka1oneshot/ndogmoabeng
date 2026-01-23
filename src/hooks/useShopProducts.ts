import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  price_eur: number;
  image_url: string | null;
  category: string | null;
  sizes: string[] | null;
  colors: string[] | null;
  stock: number | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export function useShopProducts() {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['shop-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ShopProduct[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (product: Partial<ShopProduct>) => {
      const { data, error } = await supabase
        .from('shop_products')
        .insert([product as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-products'] });
      toast.success('Produit créé avec succès');
    },
    onError: (error: Error) => {
      toast.error('Erreur lors de la création: ' + error.message);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ShopProduct> & { id: string }) => {
      const { data, error } = await supabase
        .from('shop_products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-products'] });
      toast.success('Produit mis à jour');
    },
    onError: (error: Error) => {
      toast.error('Erreur lors de la mise à jour: ' + error.message);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shop_products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-products'] });
      toast.success('Produit supprimé');
    },
    onError: (error: Error) => {
      toast.error('Erreur lors de la suppression: ' + error.message);
    },
  });

  return {
    products,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
