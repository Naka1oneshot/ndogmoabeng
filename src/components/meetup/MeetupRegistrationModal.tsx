import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Minus, Users, CreditCard, Euro, Phone, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { MeetupEvent } from '@/hooks/useMeetupEvents';
import { useMeetupPayment } from '@/hooks/useMeetupPayment';
import { supabase } from '@/integrations/supabase/client';

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
  const [interestLoading, setInterestLoading] = useState(false);
  const { createCheckout, loading, error, clearError } = useMeetupPayment();

  const totalPlayers = 1 + companionsCount;
  const totalPrice = event.price_eur * totalPlayers;
  const isFreeEvent = event.price_eur === 0;

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

    const success = await createCheckout({
      eventId: event.id,
      eventTitle: event.title,
      priceEur: event.price_eur,
      displayName: displayName.trim(),
      phone: phone.trim(),
      companionsCount,
      companionsNames,
      userNote,
    });
    
    if (success) {
      if (isFreeEvent) {
        // Free event - already confirmed
        resetForm();
        onOpenChange(false);
        onSuccess();
      } else {
        // Paid event - redirect to payment
        toast.success('Redirection vers le paiement...', {
          description: 'Complète le paiement pour confirmer ton inscription.',
        });
        resetForm();
        onOpenChange(false);
      }
    }
  };

  const handleInterestRegistration = async () => {
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

    setInterestLoading(true);
    try {
      const { error: insertError } = await supabase
        .from('meetup_registrations')
        .insert({
          meetup_event_id: event.id,
          display_name: displayName.trim(),
          phone: phone.trim(),
          companions_count: companionsCount,
          companions_names: companionsNames.filter(n => n.trim()),
          user_note: userNote || null,
          status: 'INTERESTED',
          payment_status: 'callback_requested',
        });

      if (insertError) throw insertError;

      toast.success('Inscription enregistrée !', {
        description: 'Nous vous contacterons bientôt pour finaliser votre inscription.',
      });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Interest registration error:', err);
      toast.error('Erreur lors de l\'inscription');
    } finally {
      setInterestLoading(false);
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
      <DialogContent className="sm:max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'hsl(var(--card))' }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Rejoindre « {event.title} »
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isFreeEvent 
              ? 'Remplis ce formulaire pour t\'inscrire gratuitement.'
              : 'Remplis ce formulaire puis procède au paiement pour confirmer ta place.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Price Summary */}
          {!isFreeEvent && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Euro className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Prix par personne</span>
                </div>
                <span className="text-lg font-bold text-primary">{event.price_eur} €</span>
              </div>
              {companionsCount > 0 && (
                <div className="mt-2 pt-2 border-t border-primary/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {totalPlayers} places × {event.price_eur} €
                    </span>
                    <span className="text-xl font-bold text-primary">{totalPrice} €</span>
                  </div>
                </div>
              )}
            </div>
          )}

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
              Total joueurs : <span className="font-semibold text-primary">{totalPlayers}</span>
              {!isFreeEvent && (
                <span className="ml-2">
                  → Total : <span className="font-semibold text-primary">{totalPrice} €</span>
                </span>
              )}
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

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={loading || interestLoading || !consent}
              className="w-full h-12 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold shadow-lg shadow-primary/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Préparation...
                </>
              ) : isFreeEvent ? (
                `S'inscrire (${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''})`
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payer {totalPrice} € ({totalPlayers} place{totalPlayers > 1 ? 's' : ''})
                </>
              )}
            </Button>

            {!isFreeEvent && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || interestLoading || !consent}
                  onClick={handleInterestRegistration}
                  className="w-full h-11 border-accent/50 hover:bg-accent/10 hover:border-accent text-foreground"
                >
                  {interestLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4 mr-2" />
                      Me rappeler / Payer en espèces
                    </>
                  )}
                </Button>
                
                <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Banknote className="w-3 h-3" />
                  Nous vous contacterons pour finaliser l'inscription
                </p>
              </>
            )}

            {!isFreeEvent && (
              <p className="text-center text-xs text-muted-foreground">
                🔒 Paiement en ligne sécurisé par Stripe
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
