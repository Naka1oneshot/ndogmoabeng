import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ForestButton } from '@/components/ui/ForestButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Ban, UserX } from 'lucide-react';
import { toast } from 'sonner';

interface KickPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  playerName: string;
  gameId: string;
  onSuccess?: () => void;
}

export function KickPlayerModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  gameId,
  onSuccess,
}: KickPlayerModalProps) {
  const [reason, setReason] = useState('');
  const [kicking, setKicking] = useState(false);

  const handleKick = async (withBan: boolean) => {
    if (!reason.trim()) {
      toast.error('Veuillez indiquer une raison');
      return;
    }

    setKicking(true);
    try {
      const { data, error } = await supabase.functions.invoke('kick-player', {
        body: {
          playerId,
          reason: reason.trim(),
          withBan,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Erreur lors de l\'expulsion');
      }

      const message = withBan
        ? `${playerName} a été expulsé et bloqué`
        : `${playerName} a été expulsé`;
      toast.success(message);
      
      setReason('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error('Kick error:', err);
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'expulsion');
    } finally {
      setKicking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Expulser {playerName}</DialogTitle>
          <DialogDescription>
            Choisissez le type d'expulsion. Un joueur bloqué ne pourra plus jamais rejoindre cette partie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Raison de l'expulsion *</Label>
            <Input
              id="reason"
              placeholder="Ex: Comportement inapproprié"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={kicking}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <ForestButton
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={kicking}
            className="w-full sm:w-auto"
          >
            Annuler
          </ForestButton>
          <ForestButton
            variant="outline"
            onClick={() => handleKick(false)}
            disabled={kicking || !reason.trim()}
            className="w-full sm:w-auto text-orange-500 border-orange-500/50 hover:bg-orange-500/10"
          >
            {kicking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserX className="h-4 w-4 mr-2" />
            )}
            Exclure sans bloquer
          </ForestButton>
          <ForestButton
            onClick={() => handleKick(true)}
            disabled={kicking || !reason.trim()}
            className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {kicking ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Ban className="h-4 w-4 mr-2" />
            )}
            Exclure et bloquer
          </ForestButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
