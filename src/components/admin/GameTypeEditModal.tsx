import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';
import { GameTypeData } from '@/hooks/useGameTypes';

interface GameTypeEditModalProps {
  open: boolean;
  onClose: () => void;
  gameType: GameTypeData | null;
  onSaved: () => void;
}

export function GameTypeEditModal({ open, onClose, gameType, onSaved }: GameTypeEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagline, setTagline] = useState('');
  const [lieu, setLieu] = useState('');
  const [clan, setClan] = useState('');
  const [personnages, setPersonnages] = useState('');
  const [objetCle, setObjetCle] = useState('');
  const [minPlayers, setMinPlayers] = useState(2);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (gameType) {
      setName(gameType.name || '');
      setDescription(gameType.description || '');
      setTagline(gameType.tagline || '');
      setLieu(gameType.lieu || '');
      setClan(gameType.clan || '');
      setPersonnages(gameType.personnages?.join(', ') || '');
      setObjetCle(gameType.objet_cle || '');
      setMinPlayers(gameType.min_players || 2);
      setImageUrl(gameType.image_url || '');
    }
  }, [gameType]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gameType) return;

    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${gameType.code}-${Date.now()}.${fileExt}`;
      const filePath = `game-types/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('game-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('game-assets')
        .getPublicUrl(filePath);

      setImageUrl(urlData.publicUrl);
      toast.success('Image uploadée');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!gameType) return;

    try {
      setSaving(true);
      
      const personnagesArray = personnages
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      const { error } = await supabase
        .from('game_types')
        .update({
          name,
          description: description || null,
          tagline: tagline || null,
          lieu: lieu || null,
          clan: clan || null,
          personnages: personnagesArray.length > 0 ? personnagesArray : null,
          objet_cle: objetCle || null,
          min_players: minPlayers,
          image_url: imageUrl || null,
        })
        .eq('code', gameType.code);

      if (error) throw error;

      toast.success('Jeu mis à jour');
      onSaved();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier {gameType?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Image preview */}
          <div className="space-y-2">
            <Label>Image d'illustration</Label>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border border-border">
              {imageUrl ? (
                <>
                  <img 
                    src={imageUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => setImageUrl('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Logo par défaut sera utilisé
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nom du jeu</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du jeu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ex: La traversée"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du jeu"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lieu">Lieu</Label>
              <Input
                id="lieu"
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                placeholder="Ex: Les Rivières"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clan">Clan</Label>
              <Input
                id="clan"
                value={clan}
                onChange={(e) => setClan(e.target.value)}
                placeholder="Ex: Maison Royale"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minPlayers">Joueurs minimum</Label>
            <Input
              id="minPlayers"
              type="number"
              min={1}
              value={minPlayers}
              onChange={(e) => setMinPlayers(parseInt(e.target.value) || 2)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personnages">Personnages (séparés par virgule)</Label>
            <Input
              id="personnages"
              value={personnages}
              onChange={(e) => setPersonnages(e.target.value)}
              placeholder="Ex: Capitaine, Shérif, Bras armé"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objetCle">Objet clé</Label>
            <Input
              id="objetCle"
              value={objetCle}
              onChange={(e) => setObjetCle(e.target.value)}
              placeholder="Ex: L'Essence de Ndogmoabeng"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
