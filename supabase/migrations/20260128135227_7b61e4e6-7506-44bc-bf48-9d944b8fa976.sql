-- Allow authenticated users to create adventures (not just admins)
DROP POLICY IF EXISTS "Admins can manage adventures" ON public.adventures;

-- Admins can manage ALL adventures
CREATE POLICY "Admins can manage adventures" 
ON public.adventures 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can create their own adventures
CREATE POLICY "Authenticated users can create adventures" 
ON public.adventures 
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Also need to allow inserting adventure_steps for non-admins
DROP POLICY IF EXISTS "Admins can manage adventure_steps" ON public.adventure_steps;

CREATE POLICY "Admins can manage adventure_steps" 
ON public.adventure_steps 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can create adventure_steps" 
ON public.adventure_steps 
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);