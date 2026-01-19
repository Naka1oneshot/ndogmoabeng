import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MeetupEvent, useMeetupRegistration } from '@/hooks/useMeetupEvents';

interface MeetupRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MeetupEvent;
  onSuccess: () => void;
}

export function MeetupRegistrationModal({ 
  open, 
  onOpenChange, 
  event,
  onSuccess 
}: MeetupRegistrationModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const { register, loading, error, clearError } = useMeetupRegistration();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      toast.error('Veuillez entrer votre nom');
      return;
    }
    
    if (!phone.trim() || phone.length < 8) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }
    
    if (!consent) {
      toast.error('Veuillez accepter d\'être contacté(e)');
      return;
    }

    const success = await register(event.id, displayName.trim(), phone.trim());
    
    if (success) {
      toast.success('Inscription enregistrée ! Nous te recontactons bientôt.');
      setDisplayName('');
      setPhone('');
      setConsent(false);
      onSuccess();
    } else if (error) {
      toast.error(error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      clearError();
      setDisplayName('');
      setPhone('');
      setConsent(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Rejoindre « {event.title} »
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Remplis ce formulaire pour t'inscrire. Nous te recontacterons pour confirmer ta participation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-foreground">
              Ton nom / pseudo
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Jean-Pierre"
              className="bg-surface-2 border-border focus:border-primary"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">
              Téléphone
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 06 12 34 56 78"
              className="bg-surface-2 border-border focus:border-primary"
              required
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-2/50 border border-border/50">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              className="mt-0.5"
            />
            <Label 
              htmlFor="consent" 
              className="text-sm text-muted-foreground cursor-pointer leading-relaxed"
            >
              J'accepte d'être contacté(e) pour l'organisation de l'événement.
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !consent}
            className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold shadow-lg shadow-primary/30"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Inscription...
              </>
            ) : (
              'Envoyer'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
