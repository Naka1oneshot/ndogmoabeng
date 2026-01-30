import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RulesSection, useGameRulesContent } from '@/hooks/useGameRulesContent';

interface GameRulesCreateSectionProps {
  gameCode: string;
  existingSections: RulesSection[];
  onCreated: () => void;
  onCancel: () => void;
}

export function GameRulesCreateSection({
  gameCode,
  existingSections,
  onCreated,
  onCancel,
}: GameRulesCreateSectionProps) {
  const [sectionKey, setSectionKey] = useState('');
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createSection } = useGameRulesContent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate section key
    const cleanKey = sectionKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!cleanKey) {
      setError('La clé de section est requise');
      return;
    }

    // Check for duplicate
    if (existingSections.some((s) => s.section_key === cleanKey)) {
      setError('Une section avec cette clé existe déjà');
      return;
    }

    setSaving(true);
    const maxOrder = existingSections.length > 0
      ? Math.max(...existingSections.map((s) => s.section_order))
      : 0;

    const result = await createSection(gameCode, cleanKey, {
      title: title.trim() || null,
      icon: icon.trim() || null,
      section_order: maxOrder + 1,
      content: [],
    });

    setSaving(false);

    if (result.success) {
      onCreated();
    }
  };

  return (
    <Card className="border-dashed border-2">
      <CardHeader className="py-3">
        <CardTitle className="text-base">Nouvelle section</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sectionKey">Clé de section *</Label>
              <Input
                id="sectionKey"
                value={sectionKey}
                onChange={(e) => setSectionKey(e.target.value)}
                placeholder="INTRODUCTION"
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Identifiant unique (lettres, chiffres, _)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Introduction"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icône (emoji)</Label>
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📖"
                className="w-20"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-1" />
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? 'Création...' : 'Créer la section'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
