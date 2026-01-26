import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  handleSessionExpired: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // IMPORTANT: Set up auth state change listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AUTH] onAuthStateChange:', { event, userId: session?.user?.id });
        
        // Detect session expiration from server-side invalidation
        if (event === 'SIGNED_OUT' && user !== null) {
          // Session was invalidated server-side
          setSessionExpired(true);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Then get the initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[AUTH] getSession result:', { 
        userId: session?.user?.id, 
        hasSession: !!session, 
        error: error?.message 
      });
      
      if (error && error.message.includes('session')) {
        // Session is invalid
        setSessionExpired(true);
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      setSessionExpired(false);
      // Log the login event
      try {
        await supabase.functions.invoke('log-login', {
          body: { userAgent: navigator.userAgent }
        });
      } catch (logError) {
        console.warn('Failed to log login:', logError);
        // Don't fail the login if logging fails
      }
    }
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Even if server signOut fails (e.g., session already expired),
      // we still clear the local state
      console.warn('SignOut error (session may have expired):', error);
    }
    // Always clear local state regardless of server response
    setSession(null);
    setUser(null);
  };

  const handleSessionExpired = useCallback(() => {
    setSessionExpired(true);
    setSession(null);
    setUser(null);
  }, []);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      sessionExpired,
      signIn, 
      signUp, 
      signOut,
      handleSessionExpired,
      clearSessionExpired
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
