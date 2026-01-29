import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useClanAdvantages, ClanAdvantageRow } from '@/hooks/useClanAdvantages';
import { useGameTypes } from '@/hooks/useGameTypes';
import { CLANS_DATA } from '@/data/ndogmoabengData';
import type { ClanId } from '@/lib/clanAdvantages/types';

// Import clan images
import maisonRoyaleImg from '@/assets/clans/maison-royale.png';
import fraterniteZoulousImg from '@/assets/clans/fraternite-zoulous.png';
import maisonKeryndesImg from '@/assets/clans/maison-keryndes.png';
import akandeImg from '@/assets/clans/akande.png';
import cercleAseyraImg from '@/assets/clans/cercle-aseyra.png';
import sourcesAkilaImg from '@/assets/clans/sources-akila.png';
import ezkarImg from '@/assets/clans/ezkar.png';

const clanImages: Record<string, string> = {
  'maison-royale': maisonRoyaleImg,
  'fraternite-zoulous': fraterniteZoulousImg,
  'maison-keryndes': maisonKeryndesImg,
  'akande': akandeImg,
  'cercle-aseyra': cercleAseyraImg,
  'sources-akila': sourcesAkilaImg,
  'ezkar': ezkarImg,
};

const ALL_CLAN_IDS: ClanId[] = [
  'maison-royale',
  'fraternite-zoulous',
  'maison-keryndes',
  'akande',
  'cercle-aseyra',
  'sources-akila',
  'ezkar',
];

interface EditorFormData {
  game_code: string;
  clan_id: ClanId;
  title: string;
  description: string;
  source: string;
}

const initialFormData: EditorFormData = {
  game_code: '',
  clan_id: 'maison-royale',
  title: '',
  description: '',
  source: '',
};

export function ClanAdvantagesAdminEditor() {
  const { advantages, loading, addAdvantage, updateAdvantage, deleteAdvantage } = useClanAdvantages();
  const { gameTypes } = useGameTypes();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAdvantage, setEditingAdvantage] = useState<ClanAdvantageRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditorFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  // Group advantages by game code
  const groupedAdvantages: Record<string, ClanAdvantageRow[]> = {};
  for (const adv of advantages) {
    if (!groupedAdvantages[adv.game_code]) {
      groupedAdvantages[adv.game_code] = [];
    }
    groupedAdvantages[adv.game_code].push(adv);
  }

  const getClanName = (clanId: string): string => {
    return CLANS_DATA.find(c => c.id === clanId)?.name || clanId;
  };

  const getGameName = (code: string): string => {
    return gameTypes.find(g => g.code === code)?.name || code;
  };

  const handleOpenAdd = () => {
    setFormData(initialFormData);
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (adv: ClanAdvantageRow) => {
    setFormData({
      game_code: adv.game_code,
      clan_id: adv.clan_id as ClanId,
      title: adv.title,
      description: adv.description,
      source: adv.source || '',
    });
    setEditingAdvantage(adv);
  };

  const handleSave = async () => {
    if (!formData.game_code || !formData.title || !formData.description) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSaving(true);
    try {
      if (editingAdvantage) {
        await updateAdvantage(editingAdvantage.id, {
          title: formData.title,
          description: formData.description,
          source: formData.source || undefined,
        });
        toast.success('Avantage modifié');
        setEditingAdvantage(null);
      } else {
        await addAdvantage(
          formData.game_code,
          formData.clan_id,
          formData.title,
          formData.description,
          formData.source || undefined
        );
        toast.success('Avantage ajouté');
        setIsAddDialogOpen(false);
      }
      setFormData(initialFormData);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAdvantage(id);
      toast.success('Avantage supprimé');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
    setDeleteConfirm(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Gestion des avantages</h3>
        <Button onClick={handleOpenAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Grouped advantages list */}
      <div className="space-y-4">
        {Object.entries(groupedAdvantages).map(([gameCode, advs]) => (
          <Card key={gameCode} className="border-border/50">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium">
                {getGameName(gameCode)}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {advs.length} avantage{advs.length > 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="space-y-2">
                <AnimatePresence>
                  {advs.map((adv) => (
                    <motion.div
                      key={adv.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-3 p-2 rounded-md bg-muted/30 group"
                    >
                      <img
                        src={clanImages[adv.clan_id]}
                        alt={getClanName(adv.clan_id)}
                        className="w-8 h-8 object-contain shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{adv.title}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {getClanName(adv.clan_id)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {adv.description}
                        </p>
                        {adv.source && (
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            Source: {adv.source}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleOpenEdit(adv)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(adv.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        ))}

        {Object.keys(groupedAdvantages).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Aucun avantage configuré
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un avantage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jeu *</Label>
                <Select
                  value={formData.game_code}
                  onValueChange={(v) => setFormData(f => ({ ...f, game_code: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un jeu" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameTypes.map((g) => (
                      <SelectItem key={g.code} value={g.code}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Clan *</Label>
                <Select
                  value={formData.clan_id}
                  onValueChange={(v) => setFormData(f => ({ ...f, clan_id: v as ClanId }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CLAN_IDS.map((clanId) => (
                      <SelectItem key={clanId} value={clanId}>
                        <div className="flex items-center gap-2">
                          <img src={clanImages[clanId]} alt="" className="w-4 h-4" />
                          {getClanName(clanId)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Jetons de départ ×1.5"
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="Description de l'avantage"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Source (optionnel)</Label>
              <Input
                value={formData.source}
                onChange={(e) => setFormData(f => ({ ...f, source: e.target.value }))}
                placeholder="Ex: fichier ou constante"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingAdvantage} onOpenChange={() => setEditingAdvantage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'avantage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <img
                src={clanImages[formData.clan_id]}
                alt=""
                className="w-8 h-8"
              />
              <div>
                <p className="text-sm font-medium">{getClanName(formData.clan_id)}</p>
                <p className="text-xs text-muted-foreground">{getGameName(formData.game_code)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Source (optionnel)</Label>
              <Input
                value={formData.source}
                onChange={(e) => setFormData(f => ({ ...f, source: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAdvantage(null)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet avantage ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
