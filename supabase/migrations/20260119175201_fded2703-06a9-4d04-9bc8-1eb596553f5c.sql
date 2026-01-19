-- Function to generate unique display name with suffix
CREATE OR REPLACE FUNCTION public.generate_unique_display_name(p_display_name text, p_user_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_name text;
  v_suffix integer;
  v_candidate text;
  v_exists boolean;
BEGIN
  -- Remove any existing suffix pattern (#XXX) from the name
  v_base_name := regexp_replace(p_display_name, '#[0-9]+$', '');
  v_base_name := trim(v_base_name);
  
  -- Check if base name is available (excluding current user if updating)
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE display_name = v_base_name 
    AND (p_user_id IS NULL OR user_id != p_user_id)
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RETURN v_base_name;
  END IF;
  
  -- Find the next available suffix
  v_suffix := 1;
  LOOP
    v_candidate := v_base_name || '#' || lpad(v_suffix::text, 3, '0');
    
    SELECT EXISTS (
      SELECT 1 FROM profiles 
      WHERE display_name = v_candidate 
      AND (p_user_id IS NULL OR user_id != p_user_id)
    ) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_candidate;
    END IF;
    
    v_suffix := v_suffix + 1;
    
    -- Safety limit
    IF v_suffix > 9999 THEN
      RAISE EXCEPTION 'Too many users with this display name';
    END IF;
  END LOOP;
END;
$$;

-- Trigger function to ensure unique display name
CREATE OR REPLACE FUNCTION public.ensure_unique_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate unique display name
  NEW.display_name := public.generate_unique_display_name(NEW.display_name, NEW.user_id);
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_ensure_unique_display_name ON public.profiles;
CREATE TRIGGER trigger_ensure_unique_display_name
  BEFORE INSERT OR UPDATE OF display_name ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_unique_display_name();

-- Add unique constraint on display_name
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_unique UNIQUE (display_name);