-- Table for storing editable game rules content
CREATE TABLE public.game_rules_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_code text NOT NULL,
  section_key text NOT NULL,
  section_order integer NOT NULL DEFAULT 0,
  title text,
  icon text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(game_code, section_key)
);

-- Table for version history (keep last 2 versions)
CREATE TABLE public.game_rules_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rules_content_id uuid NOT NULL REFERENCES public.game_rules_content(id) ON DELETE CASCADE,
  game_code text NOT NULL,
  section_key text NOT NULL,
  title text,
  icon text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  version_number integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.game_rules_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rules_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_rules_content
CREATE POLICY "Anyone can view game_rules_content"
  ON public.game_rules_content
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert game_rules_content"
  ON public.game_rules_content
  FOR INSERT
  WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can update game_rules_content"
  ON public.game_rules_content
  FOR UPDATE
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete game_rules_content"
  ON public.game_rules_content
  FOR DELETE
  USING (is_admin_or_super(auth.uid()));

-- RLS Policies for game_rules_history
CREATE POLICY "Admins can view game_rules_history"
  ON public.game_rules_history
  FOR SELECT
  USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can insert game_rules_history"
  ON public.game_rules_history
  FOR INSERT
  WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Admins can delete game_rules_history"
  ON public.game_rules_history
  FOR DELETE
  USING (is_admin_or_super(auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER update_game_rules_content_updated_at
  BEFORE UPDATE ON public.game_rules_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to save version before update and maintain only 2 versions
CREATE OR REPLACE FUNCTION public.save_rules_version_before_update()
RETURNS TRIGGER AS $$
DECLARE
  v_version_count integer;
  v_oldest_version_id uuid;
BEGIN
  -- Save current version to history
  INSERT INTO public.game_rules_history (
    rules_content_id,
    game_code,
    section_key,
    title,
    icon,
    content,
    version_number,
    created_by
  )
  SELECT 
    OLD.id,
    OLD.game_code,
    OLD.section_key,
    OLD.title,
    OLD.icon,
    OLD.content,
    COALESCE((SELECT MAX(version_number) + 1 FROM public.game_rules_history WHERE rules_content_id = OLD.id), 1),
    NEW.updated_by;

  -- Count versions and delete oldest if more than 2
  SELECT COUNT(*) INTO v_version_count
  FROM public.game_rules_history
  WHERE rules_content_id = OLD.id;

  IF v_version_count > 2 THEN
    SELECT id INTO v_oldest_version_id
    FROM public.game_rules_history
    WHERE rules_content_id = OLD.id
    ORDER BY version_number ASC
    LIMIT 1;

    DELETE FROM public.game_rules_history WHERE id = v_oldest_version_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to save version before update
CREATE TRIGGER save_rules_version_before_update_trigger
  BEFORE UPDATE ON public.game_rules_content
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title)
  EXECUTE FUNCTION public.save_rules_version_before_update();