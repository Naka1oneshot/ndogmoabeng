-- Allow admins to update and delete adventures
CREATE POLICY "Admins can update adventures" 
ON public.adventures 
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete adventures" 
ON public.adventures 
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update and delete adventure_steps
CREATE POLICY "Admins can update adventure_steps" 
ON public.adventure_steps 
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete adventure_steps" 
ON public.adventure_steps 
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));