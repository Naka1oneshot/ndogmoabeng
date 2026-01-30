import { useState, useEffect, useMemo, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RulesSection, RulesParagraph } from './useGameRulesContent';
import { Json } from '@/integrations/supabase/types';

export type GameCode = 'RIVIERES' | 'FORET' | 'INFECTION' | 'SHERIFF' | 'LION';

interface UseDynamicRulesResult {
  sections: RulesSection[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  getSection: (sectionKey: string) => RulesSection | undefined;
  getText: (sectionKey: string, paragraphId: string) => string;
  getList: (sectionKey: string, paragraphId: string) => string[];
  getParagraphs: (sectionKey: string) => RulesParagraph[];
}

// Helper to convert DB Json to RulesParagraph[]
function parseContent(content: Json | null): RulesParagraph[] {
  if (!content || !Array.isArray(content)) return [];
  return content as unknown as RulesParagraph[];
}

export function useDynamicRules(gameCode: GameCode): UseDynamicRulesResult {
  const [sections, setSections] = useState<RulesSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fetchRules() {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
          .from('game_rules_content')
          .select('*')
          .eq('game_code', gameCode)
          .eq('is_visible', true)
          .order('section_order', { ascending: true });

        if (fetchError) throw fetchError;

        if (mounted) {
          const typedData = (data || []).map(item => ({
            ...item,
            content: parseContent(item.content)
          })) as RulesSection[];
          setSections(typedData);
        }
      } catch (err) {
        console.error('Error fetching dynamic rules:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchRules();

    return () => {
      mounted = false;
    };
  }, [gameCode, refreshKey]);

  const helpers = useMemo(() => ({
    getSection: (sectionKey: string) => sections.find(s => s.section_key === sectionKey),
    
    getText: (sectionKey: string, paragraphId: string): string => {
      const section = sections.find(s => s.section_key === sectionKey);
      if (!section) return '';
      const paragraph = section.content.find(p => p.id === paragraphId);
      return paragraph?.text || '';
    },
    
    getList: (sectionKey: string, paragraphId: string): string[] => {
      const section = sections.find(s => s.section_key === sectionKey);
      if (!section) return [];
      const paragraph = section.content.find(p => p.id === paragraphId);
      return paragraph?.items || [];
    },
    
    getParagraphs: (sectionKey: string): RulesParagraph[] => {
      const section = sections.find(s => s.section_key === sectionKey);
      return section?.content || [];
    }
  }), [sections]);

  return {
    sections,
    loading,
    error,
    refetch,
    ...helpers
  };
}

// Context provider for sharing rules across components
interface DynamicRulesContextValue extends UseDynamicRulesResult {
  gameCode: GameCode;
}

const DynamicRulesContext = createContext<DynamicRulesContextValue | null>(null);

interface DynamicRulesProviderProps {
  gameCode: GameCode;
  children: ReactNode;
}

export function DynamicRulesProvider({ gameCode, children }: DynamicRulesProviderProps) {
  const rules = useDynamicRules(gameCode);

  return (
    <DynamicRulesContext.Provider value={{ ...rules, gameCode }}>
      {children}
    </DynamicRulesContext.Provider>
  );
}

export function useDynamicRulesContext(): DynamicRulesContextValue {
  const context = useContext(DynamicRulesContext);
  if (!context) {
    throw new Error('useDynamicRulesContext must be used within DynamicRulesProvider');
  }
  return context;
}
