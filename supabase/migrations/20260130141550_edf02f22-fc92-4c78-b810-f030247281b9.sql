-- Create early access requests table
CREATE TABLE public.early_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.early_access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request (public form)
CREATE POLICY "Anyone can submit early access request"
ON public.early_access_requests
FOR INSERT
WITH CHECK (true);

-- Admins can view all requests
CREATE POLICY "Admins can view early access requests"
ON public.early_access_requests
FOR SELECT
USING (is_admin_or_super(auth.uid()));

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update early access requests"
ON public.early_access_requests
FOR UPDATE
USING (is_admin_or_super(auth.uid()));

-- Admins can delete requests
CREATE POLICY "Admins can delete early access requests"
ON public.early_access_requests
FOR DELETE
USING (is_admin_or_super(auth.uid()));