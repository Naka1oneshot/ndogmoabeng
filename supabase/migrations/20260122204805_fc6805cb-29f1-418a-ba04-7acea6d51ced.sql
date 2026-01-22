-- Create admin actions audit log table
CREATE TABLE public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  performed_by UUID NOT NULL,
  performed_by_email TEXT NOT NULL,
  target_user_id UUID NOT NULL,
  target_user_email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'PROMOTE_ADMIN', 'REVOKE_ADMIN', 'GRANT_TOKENS', 'GRANT_LOYALTY'
  details JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admins can view the audit log
CREATE POLICY "Super admins can view audit log"
ON public.admin_audit_log
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Service role can insert (from edge functions)
CREATE POLICY "Service role can insert audit log"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_target ON public.admin_audit_log(target_user_id);