-- Create shop_products table
CREATE TABLE public.shop_products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_eur NUMERIC(10, 2) NOT NULL DEFAULT 0,
    image_url TEXT,
    category TEXT DEFAULT 'T-Shirt',
    sizes TEXT[] DEFAULT ARRAY['S', 'M', 'L', 'XL', 'XXL'],
    colors TEXT[] DEFAULT ARRAY[]::TEXT[],
    stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;

-- Everyone can view active products
CREATE POLICY "Anyone can view active products"
ON public.shop_products
FOR SELECT
USING (is_active = true);

-- Admins can manage products (using the has_role function that already exists)
CREATE POLICY "Admins can manage products"
ON public.shop_products
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_shop_products_updated_at
BEFORE UPDATE ON public.shop_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();