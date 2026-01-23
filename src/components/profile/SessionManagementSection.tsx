import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function SessionManagementSection() {
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignOutOtherSessions = async () => {
    setIsLoading(true);
    setSuccess(false);
    
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      
      if (error) {
        throw error;
      }
      
      setSuccess(true);
      toast.success('Toutes les autres sessions ont été déconnectées');
      
      // Reset success state after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error signing out other sessions:', error);
      toast.error('Erreur lors de la déconnexion des autres sessions');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Gestion des sessions
        </CardTitle>
        <CardDescription>
          Déconnectez-vous de tous les autres appareils où votre compte est connecté
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          onClick={handleSignOutOtherSessions}
          disabled={isLoading || success}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Déconnexion en cours...
            </>
          ) : success ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Sessions déconnectées
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Déconnecter les autres sessions
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
