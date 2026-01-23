import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function ChangePasswordSection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsExpanded(false);
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Le mot de passe doit contenir au moins une majuscule';
    }
    if (!/[0-9]/.test(password)) {
      return 'Le mot de passe doit contenir au moins un chiffre';
    }
    return null;
  };

  const handleChangePassword = async () => {
    // Validate new password
    const validationError = validatePassword(newPassword);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      // Update password using Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        if (error.message.includes('same as')) {
          toast.error('Le nouveau mot de passe doit être différent de l\'ancien');
        } else {
          toast.error(error.message || 'Erreur lors du changement de mot de passe');
        }
        return;
      }

      toast.success('Mot de passe modifié avec succès');
      resetForm();
    } catch (error) {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => setIsExpanded(true)}
      >
        <Lock className="w-4 h-4 mr-2" />
        Changer mon mot de passe
      </Button>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Changer le mot de passe
        </CardTitle>
        <CardDescription>
          Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new_password">Nouveau mot de passe</Label>
          <div className="relative">
            <Input
              id="new_password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {newPassword && (
            <div className="text-xs space-y-1">
              <div className={`flex items-center gap-1 ${newPassword.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`}>
                {newPassword.length >= 8 && <Check className="w-3 h-3" />}
                Au moins 8 caractères
              </div>
              <div className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-muted-foreground'}`}>
                {/[A-Z]/.test(newPassword) && <Check className="w-3 h-3" />}
                Au moins une majuscule
              </div>
              <div className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-green-500' : 'text-muted-foreground'}`}>
                {/[0-9]/.test(newPassword) && <Check className="w-3 h-3" />}
                Au moins un chiffre
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirmer le mot de passe</Label>
          <div className="relative">
            <Input
              id="confirm_password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
          )}
          {confirmPassword && newPassword === confirmPassword && (
            <p className="text-xs text-green-500 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Les mots de passe correspondent
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={resetForm}
            disabled={loading}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleChangePassword}
            disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Modification...
              </>
            ) : (
              'Changer le mot de passe'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
