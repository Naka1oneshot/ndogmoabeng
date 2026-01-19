import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Minus, Users } from 'lucide-react';
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
  const [companionsCount, setCompanionsCount] = useState(0);
  const [companionsNames, setCompanionsNames] = useState<string[]>([]);
  const [userNote, setUserNote] = useState('');
  const [consent, setConsent] = useState(false);
  const { register, loading, error, clearError } = useMeetupRegistration();

  const handleCompanionsCountChange = (delta: number) => {
    const newCount = Math.max(0, Math.min(10, companionsCount + delta));
    setCompanionsCount(newCount);
    
    // Adjust companions names array
    if (newCount > companionsNames.length) {
      setCompanionsNames([...companionsNames, ...Array(newCount - companionsNames.length).fill('')]);
    } else {
      setCompanionsNames(companionsNames.slice(0, newCount));
    }
  };

  const handleCompanionNameChange = (index: number, value: string) => {
    const newNames = [...companionsNames];
    newNames[index] = value;
    setCompanionsNames(newNames);
  };

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

    const success = await register(event.id, {
      displayName: displayName.trim(),
      phone: phone.trim(),
      companionsCount,
      companionsNames,
      userNote,
    });
    
    if (success) {
      const totalPlayers = 1 + companionsCount;
      toast.success(`Inscription enregistrée pour ${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''} ! Nous te recontactons bientôt.`);
      resetForm();
      onSuccess();
    } else if (error) {
      toast.error(error);
    }
  };

  const resetForm = () => {
    setDisplayName('');
    setPhone('');
    setCompanionsCount(0);
    setCompanionsNames([]);
    setUserNote('');
    setConsent(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      clearError();
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-surface border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Rejoindre « {event.title} »
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Remplis ce formulaire pour t'inscrire. Nous te recontacterons pour confirmer ta participation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Nom / Pseudo */}
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

          {/* Téléphone */}
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

          {/* Accompagnants */}
          <div className="space-y-3 p-4 rounded-lg bg-surface-2/50 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                <Label className="text-foreground">Accompagnant(s)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCompanionsCountChange(-1)}
                  disabled={companionsCount === 0}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-8 text-center font-semibold text-foreground">
                  {companionsCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCompanionsCountChange(1)}
                  disabled={companionsCount >= 10}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {companionsCount > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  Pseudos des accompagnants (optionnel) :
                </p>
                {companionsNames.map((name, index) => (
                  <Input
                    key={index}
                    value={name}
                    onChange={(e) => handleCompanionNameChange(index, e.target.value)}
                    placeholder={`Accompagnant ${index + 1}`}
                    className="bg-surface border-border/50 text-sm h-9"
                  />
                ))}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Total joueurs : <span className="font-semibold text-primary">{1 + companionsCount}</span>
            </p>
          </div>

          {/* Note / Commentaire */}
          <div className="space-y-2">
            <Label htmlFor="userNote" className="text-foreground">
              Questions / Commentaires <span className="text-muted-foreground text-xs">(optionnel)</span>
            </Label>
            <Textarea
              id="userNote"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="Ex: Avez-vous un parking ? Peut-on arriver en retard ?"
              className="bg-surface-2 border-border focus:border-primary min-h-[80px] resize-none"
              maxLength={500}
            />
          </div>

          {/* Consentement */}
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
              `Envoyer (${1 + companionsCount} joueur${1 + companionsCount > 1 ? 's' : ''})`
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
