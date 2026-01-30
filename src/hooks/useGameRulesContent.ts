import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

export interface RulesSection {
  id: string;
  game_code: string;
  section_key: string;
  section_order: number;
  title: string | null;
  icon: string | null;
  content: RulesParagraph[];
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface RulesParagraph {
  id: string;
  type: 'text' | 'list' | 'note' | 'warning' | 'example';
  text?: string;
  items?: string[];
}

export interface RulesHistoryEntry {
  id: string;
  rules_content_id: string;
  game_code: string;
  section_key: string;
  title: string | null;
  icon: string | null;
  content: RulesParagraph[];
  version_number: number;
  created_at: string;
  created_by: string | null;
}

// Helper to convert DB Json to RulesParagraph[]
function parseContent(content: Json | null): RulesParagraph[] {
  if (!content || !Array.isArray(content)) return [];
  return content as unknown as RulesParagraph[];
}

// Helper to convert RulesParagraph[] to Json
function contentToJson(content: RulesParagraph[]): Json {
  return content as unknown as Json;
}

export function useGameRulesContent(gameCode?: string) {
  const [sections, setSections] = useState<RulesSection[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSections = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('game_rules_content')
        .select('*')
        .order('section_order', { ascending: true });

      if (gameCode) {
        query = query.eq('game_code', gameCode);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        ...item,
        content: parseContent(item.content)
      })) as RulesSection[];
      
      setSections(typedData);
    } catch (err) {
      console.error('Error fetching rules content:', err);
    } finally {
      setLoading(false);
    }
  }, [gameCode]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const updateSection = async (
    sectionId: string,
    updates: Partial<Pick<RulesSection, 'title' | 'icon' | 'content' | 'is_visible' | 'section_order'>>
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const dbUpdates: Record<string, unknown> = {
        updated_by: userData.user?.id || null,
      };
      
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
      if (updates.is_visible !== undefined) dbUpdates.is_visible = updates.is_visible;
      if (updates.section_order !== undefined) dbUpdates.section_order = updates.section_order;
      if (updates.content !== undefined) dbUpdates.content = contentToJson(updates.content);
      
      const { error } = await supabase
        .from('game_rules_content')
        .update(dbUpdates)
        .eq('id', sectionId);

      if (error) throw error;

      toast({
        title: 'Section mise à jour',
        description: 'Les modifications ont été enregistrées.',
      });

      await fetchSections();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating section:', err);
      toast({
        title: 'Erreur',
        description: err.message || "Une erreur s'est produite",
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  const createSection = async (
    gameCode: string,
    sectionKey: string,
    data: Partial<Pick<RulesSection, 'title' | 'icon' | 'content' | 'section_order'>>
  ) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('game_rules_content')
        .insert({
          game_code: gameCode,
          section_key: sectionKey,
          title: data.title || null,
          icon: data.icon || null,
          content: contentToJson(data.content || []),
          section_order: data.section_order || 0,
          updated_by: userData.user?.id || null,
        });

      if (error) throw error;

      toast({
        title: 'Section créée',
        description: 'La nouvelle section a été ajoutée.',
      });

      await fetchSections();
      return { success: true };
    } catch (err: any) {
      console.error('Error creating section:', err);
      toast({
        title: 'Erreur',
        description: err.message || "Une erreur s'est produite",
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  const deleteSection = async (sectionId: string) => {
    try {
      const { error } = await supabase
        .from('game_rules_content')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      toast({
        title: 'Section supprimée',
        description: 'La section a été supprimée.',
      });

      await fetchSections();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting section:', err);
      toast({
        title: 'Erreur',
        description: err.message || "Une erreur s'est produite",
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  return {
    sections,
    loading,
    updateSection,
    createSection,
    deleteSection,
    refetch: fetchSections,
  };
}

export function useGameRulesHistory(sectionId?: string) {
  const [history, setHistory] = useState<RulesHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!sectionId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('game_rules_history')
        .select('*')
        .eq('rules_content_id', sectionId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(item => ({
        ...item,
        content: parseContent(item.content)
      })) as RulesHistoryEntry[];
      
      setHistory(typedData);
    } catch (err) {
      console.error('Error fetching rules history:', err);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const restoreVersion = async (historyEntry: RulesHistoryEntry) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('game_rules_content')
        .update({
          title: historyEntry.title,
          icon: historyEntry.icon,
          content: contentToJson(historyEntry.content),
          updated_by: userData.user?.id || null,
        })
        .eq('id', historyEntry.rules_content_id);

      if (error) throw error;

      toast({
        title: 'Version restaurée',
        description: `La version ${historyEntry.version_number} a été restaurée.`,
      });

      await fetchHistory();
      return { success: true };
    } catch (err: any) {
      console.error('Error restoring version:', err);
      toast({
        title: 'Erreur',
        description: err.message || "Une erreur s'est produite",
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  };

  return {
    history,
    loading,
    restoreVersion,
    refetch: fetchHistory,
  };
}
