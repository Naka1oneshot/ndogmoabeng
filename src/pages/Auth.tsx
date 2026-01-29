import { useState, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ForestButton } from '@/components/ui/ForestButton';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock, AlertCircle, User, Phone, CheckCircle, Edit2, Clock, Camera, X, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import logoNdogmoabeng from '@/assets/logo-ndogmoabeng.png';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
});

const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  displayName: z.string().min(1, 'Le pseudo est requis').max(14, 'Le pseudo ne doit pas dépasser 14 caractères'),
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
  
  // Avatar upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Forgot password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image valide');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5 Mo');
      return;
    }
    
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!forgotPasswordEmail) {
      setError('Veuillez entrer votre adresse email');
      return;
    }
    
    setForgotPasswordLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      
      if (error) {
        setError(error.message);
        return;
      }
      
      setForgotPasswordSent(true);
      toast.success('Un email de réinitialisation a été envoyé');
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Erreur lors de l\'envoi de l\'email');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

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
        let avatarUrl = null;
        
        // Upload avatar if provided
        if (avatarFile) {
          const fileExt = avatarFile.name.split('.').pop();
          const fileName = `${user.id}/avatar.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, avatarFile, { upsert: true });
          
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
            avatarUrl = urlData.publicUrl;
          } else {
            console.error('Error uploading avatar:', uploadError);
          }
        }
        
        // Create profile with the confirmed display name
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            display_name: finalDisplayName,
            phone: phone || null,
            avatar_url: avatarUrl,
          });
        
        if (profileError) {
          console.error('Error creating profile:', profileError);
          setError('Erreur lors de la création du profil');
          return;
        }
      }
      
      // Redirect to onboarding quiz for new users
      navigate('/onboarding/clan-quiz', { replace: true });
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
    setAvatarFile(null);
    setAvatarPreview(null);
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setForgotPasswordSent(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  // Forgot password screen
  if (showForgotPassword) {
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
              Mot de passe oublié
            </h1>
            <p className="text-muted-foreground">
              Entrez votre email pour recevoir un lien de réinitialisation
            </p>
          </div>

          <div className="card-gradient rounded-lg border border-border p-6 space-y-4">
            {forgotPasswordSent ? (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-green-500/20">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-lg font-semibold">Email envoyé !</h2>
                <p className="text-muted-foreground text-sm">
                  Si un compte existe avec l'adresse <strong>{forgotPasswordEmail}</strong>, 
                  vous recevrez un lien de réinitialisation.
                </p>
                <ForestButton onClick={() => setShowForgotPassword(false)} className="w-full">
                  Retour à la connexion
                </ForestButton>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <ForestButton type="submit" className="w-full" disabled={forgotPasswordLoading}>
                  {forgotPasswordLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    'Envoyer le lien'
                  )}
                </ForestButton>
                
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Retour à la connexion
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

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

            {/* Avatar preview */}
            {avatarPreview && (
              <div className="flex justify-center">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarPreview} alt="Avatar" />
                  <AvatarFallback>{finalDisplayName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
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
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Inscription...
                  </>
                ) : (
                  'Confirmer'
                )}
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
              {/* Avatar upload */}
              <div className="flex justify-center">
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="cursor-pointer block"
                  >
                    <Avatar className="h-20 w-20 border-2 border-dashed border-border hover:border-primary transition-colors">
                      {avatarPreview ? (
                        <AvatarImage src={avatarPreview} alt="Avatar" />
                      ) : (
                        <AvatarFallback className="bg-secondary">
                          <Camera className="h-6 w-6 text-muted-foreground" />
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </label>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Cliquez pour ajouter une photo de profil (facultatif)
              </p>

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
                <div className="flex items-center justify-between">
                  <Label htmlFor="displayName">Pseudo *</Label>
                  <span className={`text-xs ${displayName.length > 14 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {displayName.length}/14
                  </span>
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="MonPseudo"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 14))}
                    className="pl-10"
                    maxLength={14}
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

          {isLogin && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-primary hover:underline"
            >
              Mot de passe oublié ?
            </button>
          )}

          <ForestButton type="submit" className="w-full" disabled={loading || checkingDisplayName}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Chargement...
              </>
            ) : checkingDisplayName ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vérification...
              </>
            ) : isLogin ? (
              'Se connecter'
            ) : (
              'Continuer'
            )}
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