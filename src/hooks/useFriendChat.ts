import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  message_type: 'text' | 'game_invite';
  payload?: {
    game_id?: string;
    game_name?: string;
    join_code?: string;
  };
  read_at: string | null;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

interface Conversation {
  friend_id: string;
  friend_name: string;
  friend_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export function useFriendChat(selectedFriendId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;

    try {
      // Get all messages involving the user
      const { data: allMessages, error } = await supabase
        .from('friend_chat_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique friend IDs
      const friendIds = new Set<string>();
      allMessages?.forEach(msg => {
        const friendId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        friendIds.add(friendId);
      });

      // Fetch friend profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', Array.from(friendIds));

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Build conversations
      const convMap = new Map<string, Conversation>();
      let unreadTotal = 0;

      allMessages?.forEach(msg => {
        const friendId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const profile = profileMap.get(friendId);
        
        const isUnread = msg.receiver_id === user.id && !msg.read_at;
        if (isUnread) unreadTotal++;

        if (!convMap.has(friendId)) {
          convMap.set(friendId, {
            friend_id: friendId,
            friend_name: profile?.display_name || 'Utilisateur',
            friend_avatar: profile?.avatar_url || null,
            last_message: msg.message_type === 'game_invite' 
              ? '🎮 Invitation à rejoindre une partie'
              : msg.message,
            last_message_at: msg.created_at,
            unread_count: isUnread ? 1 : 0,
          });
        } else if (isUnread) {
          const conv = convMap.get(friendId)!;
          conv.unread_count++;
        }
      });

      setConversations(Array.from(convMap.values()).sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      ));
      setTotalUnread(unreadTotal);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [user]);

  // Fetch messages for a specific friend
  const fetchMessages = useCallback(async (friendId: string) => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('friend_chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const enrichedMessages: ChatMessage[] = data?.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        message: msg.message,
        message_type: msg.message_type as 'text' | 'game_invite',
        payload: msg.payload as ChatMessage['payload'],
        read_at: msg.read_at,
        created_at: msg.created_at,
        sender_name: profileMap.get(msg.sender_id)?.display_name || 'Utilisateur',
        sender_avatar: profileMap.get(msg.sender_id)?.avatar_url || undefined,
      })) || [];

      setMessages(enrichedMessages);

      // Mark unread messages as read
      const unreadIds = data?.filter(m => m.receiver_id === user.id && !m.read_at).map(m => m.id) || [];
      if (unreadIds.length > 0) {
        await supabase
          .from('friend_chat_messages')
          .update({ read_at: new Date().toISOString() })
          .in('id', unreadIds);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Send a text message
  const sendMessage = async (receiverId: string, message: string) => {
    if (!user || !message.trim()) return { error: 'Message vide' };

    try {
      const { error } = await supabase
        .from('friend_chat_messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          message: message.trim(),
          message_type: 'text',
        });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      console.error('Error sending message:', error);
      return { error: error.message };
    }
  };

  // Send a game invitation
  const sendGameInvite = async (receiverId: string, gameId: string, gameName: string, joinCode: string) => {
    if (!user) return { error: 'Non connecté' };

    try {
      const { error } = await supabase
        .from('friend_chat_messages')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          message: `Je t'invite à rejoindre ma partie "${gameName}"`,
          message_type: 'game_invite',
          payload: { game_id: gameId, game_name: gameName, join_code: joinCode },
        });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      console.error('Error sending game invite:', error);
      return { error: error.message };
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    fetchConversations();

    const channel = supabase
      .channel('friend_chat_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_chat_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          // Refetch conversations and messages
          fetchConversations();
          if (selectedFriendId) {
            fetchMessages(selectedFriendId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedFriendId, fetchConversations, fetchMessages]);

  // Fetch messages when friend changes
  useEffect(() => {
    if (selectedFriendId) {
      fetchMessages(selectedFriendId);
    }
  }, [selectedFriendId, fetchMessages]);

  return {
    messages,
    conversations,
    loading,
    totalUnread,
    sendMessage,
    sendGameInvite,
    refetch: fetchConversations,
  };
}
