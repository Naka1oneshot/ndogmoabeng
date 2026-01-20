import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, AlertCircle, User, Phone, CheckCircle, Edit2, Clock } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  displayName: z.string().min(1, 'Le pseudo est requis'),
  phone: z.string().optional(),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // New states for display name confirmation
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [finalDisplayName, setFinalDisplayName] = useState('');
  const [checkingDisplayName, setCheckingDisplayName] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the redirect path and session expired flag from location state
  const locationState = location.state as { from?: string; sessionExpired?: boolean } | null;
  const from = locationState?.from || '/';
  const sessionExpired = locationState?.sessionExpired || false;

  const checkDisplayNameAvailability = async () => {
    setCheckingDisplayName(true);
    setError('');
    
    try {
      // Call the database function to get the unique display name
      const { data, error } = await supabase.rpc('generate_unique_display_name', {
        p_display_name: displayName,
        p_user_id: null
      });
      
      if (error) {
        console.error('Error checking display name:', error);
        setError('Erreur lors de la vérification du pseudo');
        return;
      }
      
      setFinalDisplayName(data);
      setShowConfirmation(true);
    } finally {
      setCheckingDisplayName(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (isLogin) {
      const validation = loginSchema.safeParse({ email, password });
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
    } else {
      // For signup, first validate then check display name
      const validation = signupSchema.safeParse({ 
        email, 
        password, 
        firstName, 
        lastName, 
        displayName,
        phone: phone || undefined
      });
      if (!validation.success) {
        setError(validation.error.errors[0].message);
        return;
      }
      
      // Check display name availability
      await checkDisplayNameAvailability();
    }
  };

  const handleConfirmSignup = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { error: signUpError } = await signUp(email, password);
      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Cet email est déjà utilisé');
        } else {
          setError(signUpError.message);
        }
        return;
      }
      
      // Get the user after signup
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Create profile with the confirmed display name
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            display_name: finalDisplayName,
            phone: phone || null,
          });
        
        if (profileError) {
          console.error('Error creating profile:', profileError);
          setError('Erreur lors de la création du profil');
          return;
        }
      }
      
      navigate(from);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDisplayName = () => {
    setShowConfirmation(false);
    setFinalDisplayName('');
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setDisplayName('');
    setPhone('');
    setError('');
    setShowConfirmation(false);
    setFinalDisplayName('');
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  // Confirmation screen for display name
  if (showConfirmation && !isLogin) {
    const displayNameChanged = finalDisplayName !== displayName;
    
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center justify-center w-24 h-24 mb-4 animate-float">
              <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
            </Link>
            <h1 className="font-display text-2xl text-glow mb-2">
              Confirmation du pseudo
            </h1>
            <p className="text-muted-foreground">
              Vérifiez votre pseudo avant de finaliser l'inscription
            </p>
          </div>

          <div className="card-gradient rounded-lg border border-border p-6 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="text-center space-y-4">
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">Votre pseudo sera :</p>
                <p className="text-2xl font-bold text-primary">{finalDisplayName}</p>
              </div>
              
              {displayNameChanged && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-left">
                    Le pseudo "<strong>{displayName}</strong>" était déjà pris. 
                    Un suffixe a été ajouté pour le rendre unique.
                  </p>
                </div>
              )}

              {!displayNameChanged && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm">Ce pseudo est disponible !</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <ForestButton
                type="button"
                variant="outline"
                onClick={handleEditDisplayName}
                className="flex-1"
                disabled={loading}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Modifier
              </ForestButton>
              
              <ForestButton
                type="button"
                onClick={handleConfirmSignup}
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Inscription...' : 'Confirmer'}
              </ForestButton>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Déjà un compte ? Se connecter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      {/* Theme toggle in top-right corner */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-24 h-24 mb-4 animate-float">
            <img src={logoNdogmoabeng} alt="Ndogmoabeng" className="w-full h-full object-contain" />
          </Link>
          <h1 className="font-display text-2xl text-glow mb-2">
            Le Village de Ndogmoabeng
          </h1>
          <p className="text-muted-foreground">
            {isLogin ? 'Connectez-vous pour continuer' : 'Créez votre compte'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-gradient rounded-lg border border-border p-6 space-y-4">
          {sessionExpired && (
            <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-600 dark:text-amber-400">
                Votre session a expiré. Veuillez vous reconnecter pour continuer.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Dupont"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Jean"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Pseudo *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="MonPseudo"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone (facultatif)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <ForestButton type="submit" className="w-full" disabled={loading || checkingDisplayName}>
            {loading ? 'Chargement...' : checkingDisplayName ? 'Vérification...' : isLogin ? 'Se connecter' : 'Continuer'}
          </ForestButton>

          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
