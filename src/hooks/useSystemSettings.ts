import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatConfig {
  general_chat_enabled: boolean;
  lobby_chat_enabled: boolean;
  ingame_chat_enabled: boolean;
  max_messages_per_game: number;
}

const DEFAULT_CHAT_CONFIG: ChatConfig = {
  general_chat_enabled: false,
  lobby_chat_enabled: true,
  ingame_chat_enabled: true,
  max_messages_per_game: 100,
};

export function useSystemSettings() {
  const [chatConfig, setChatConfig] = useState<ChatConfig>(DEFAULT_CHAT_CONFIG);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', 'chat_config')
        .maybeSingle();

      if (error) {
        console.error('Error fetching system settings:', error);
        return;
      }

      if (data?.value) {
        setChatConfig({
          ...DEFAULT_CHAT_CONFIG,
          ...(data.value as Partial<ChatConfig>),
        });
      }
    } catch (err) {
      console.error('Error fetching system settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to changes
    const channel = supabase
      .channel('system-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.chat_config',
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'value' in payload.new) {
            setChatConfig({
              ...DEFAULT_CHAT_CONFIG,
              ...(payload.new.value as Partial<ChatConfig>),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  const updateChatConfig = async (updates: Partial<ChatConfig>): Promise<{ error?: Error }> => {
    const newConfig = { ...chatConfig, ...updates };
    
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'chat_config',
          value: newConfig,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        });

      if (error) throw error;
      
      setChatConfig(newConfig);
      return {};
    } catch (err) {
      console.error('Error updating chat config:', err);
      return { error: err instanceof Error ? err : new Error('Unknown error') };
    }
  };

  return {
    chatConfig,
    loading,
    updateChatConfig,
    refetch: fetchSettings,
  };
}
