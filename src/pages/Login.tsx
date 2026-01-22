import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, AlertCircle, Shield, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

const authSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

// Check if we're in development mode - only check DEV flag, never expose based on env vars
const isDevelopment = import.meta.env.DEV;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingTestAdmin, setCreatingTestAdmin] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the redirect path from state, default to home page
  const from = (location.state as { from?: string })?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Email ou mot de passe incorrect');
        } else {
          setError(error.message);
        }
        return;
      }
      navigate(from);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTestAdmin = async () => {
    setError('');
    setCreatingTestAdmin(true);

    try {
      // Call edge function to create/ensure test admin exists
      const { data, error: fnError } = await supabase.functions.invoke('create-test-admin');
      
      if (fnError) {
        setError('Erreur lors de la création du compte admin: ' + fnError.message);
        return;
      }

      if (!data?.success) {
        setError(data?.error || 'Erreur inconnue');
        return;
      }

      // Now sign in with the test admin credentials
      const { error: signInError } = await signIn('admin@test.ndogmoabeng', 'Admin123!');
      
      if (signInError) {
        setError('Compte créé, mais erreur de connexion: ' + signInError.message);
        return;
      }

      navigate(from);
    } catch (err) {
      console.error('Error creating test admin:', err);
      setError('Erreur inattendue lors de la création du compte');
    } finally {
      setCreatingTestAdmin(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-24 h-24 mb-4 animate-float">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
          </Link>
          <h1 className="font-display text-2xl text-glow mb-2">
            La Forêt de Ndogmoabeng
          </h1>
          <p className="text-muted-foreground">
            Connectez-vous pour accéder au tableau de bord MJ
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-gradient rounded-lg border border-border p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ForestButton type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connexion...
              </>
            ) : (
              'Se connecter'
            )}
          </ForestButton>

          {isDevelopment && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Mode développement</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateTestAdmin}
                disabled={creatingTestAdmin}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-primary/50 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                {creatingTestAdmin ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    Créer un compte Admin de test
                  </>
                )}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                Compte de test pour le développement local
              </p>
            </>
          )}

          <div className="text-center">
            <a
              href="/auth"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pas de compte ? S'inscrire
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
