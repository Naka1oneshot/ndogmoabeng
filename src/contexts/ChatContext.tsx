import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ChatContextType {
  isChatHidden: boolean;
  hideChat: () => void;
  showChat: () => void;
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [isChatHidden, setIsChatHidden] = useState(false);

  const hideChat = useCallback(() => setIsChatHidden(true), []);
  const showChat = useCallback(() => setIsChatHidden(false), []);
  const toggleChat = useCallback(() => setIsChatHidden(prev => !prev), []);

  return (
    <ChatContext.Provider value={{ isChatHidden, hideChat, showChat, toggleChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatVisibility() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatVisibility must be used within a ChatProvider');
  }
  return context;
}
