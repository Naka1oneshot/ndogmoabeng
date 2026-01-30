import { useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Save, X, Trash2, Eye, EyeOff, History, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RulesSection, RulesParagraph, useGameRulesContent, useGameRulesHistory } from '@/hooks/useGameRulesContent';
import { RulesParagraphEditor } from './RulesParagraphEditor';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface GameRulesSectionEditorProps {
  section: RulesSection;
  onUpdate: () => void;
}

export function GameRulesSectionEditor({ section, onUpdate }: GameRulesSectionEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(section.title || '');
  const [icon, setIcon] = useState(section.icon || '');
  const [content, setContent] = useState<RulesParagraph[]>(section.content);
  const [order, setOrder] = useState(section.section_order);
  const [isVisible, setIsVisible] = useState(section.is_visible);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { updateSection, deleteSection } = useGameRulesContent();
  const { history, loading: historyLoading, restoreVersion } = useGameRulesHistory(
    historyOpen ? section.id : undefined
  );

  const handleSave = async () => {
    setSaving(true);
    const result = await updateSection(section.id, {
      title: title || null,
      icon: icon || null,
      content,
      section_order: order,
      is_visible: isVisible,
    });
    setSaving(false);
    
    if (result.success) {
      setIsEditing(false);
      onUpdate();
    }
  };

  const handleCancel = () => {
    setTitle(section.title || '');
    setIcon(section.icon || '');
    setContent(section.content);
    setOrder(section.section_order);
    setIsVisible(section.is_visible);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteSection(section.id);
    onUpdate();
  };

  const handleRestoreVersion = async (historyEntry: any) => {
    const result = await restoreVersion(historyEntry);
    if (result.success) {
      setHistoryOpen(false);
      onUpdate();
    }
  };

  const addParagraph = (type: RulesParagraph['type']) => {
    const newParagraph: RulesParagraph = {
      id: crypto.randomUUID(),
      type,
      text: type === 'list' ? undefined : '',
      items: type === 'list' ? [''] : undefined,
    };
    setContent([...content, newParagraph]);
  };

  const updateParagraph = (index: number, updates: Partial<RulesParagraph>) => {
    const newContent = [...content];
    newContent[index] = { ...newContent[index], ...updates };
    setContent(newContent);
  };

  const removeParagraph = (index: number) => {
    setContent(content.filter((_, i) => i !== index));
  };

  const moveParagraph = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === content.length - 1)
    ) {
      return;
    }
    
    const newContent = [...content];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newContent[index], newContent[newIndex]] = [newContent[newIndex], newContent[index]];
    setContent(newContent);
  };

  return (
    <Card className={!isVisible ? 'opacity-60' : ''}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-lg">{section.icon || '📄'}</span>
                <span className="font-medium">{section.title || section.section_key}</span>
                <Badge variant="outline" className="text-xs">
                  {section.section_key}
                </Badge>
                {!isVisible && (
                  <Badge variant="secondary" className="text-xs">
                    <EyeOff className="w-3 h-3 mr-1" />
                    Masqué
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-muted-foreground mr-2">
                  Ordre: {section.section_order}
                </span>
                {!isEditing && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titre de la section"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Icône (emoji)</Label>
                    <Input
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      placeholder="🎮"
                      className="w-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ordre d'affichage</Label>
                    <Input
                      type="number"
                      value={order}
                      onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={isVisible}
                    onCheckedChange={setIsVisible}
                    id="visibility"
                  />
                  <Label htmlFor="visibility">Section visible</Label>
                </div>

                <div className="space-y-3">
                  <Label>Contenu</Label>
                  {content.map((paragraph, index) => (
                    <RulesParagraphEditor
                      key={paragraph.id}
                      paragraph={paragraph}
                      index={index}
                      total={content.length}
                      onUpdate={(updates) => updateParagraph(index, updates)}
                      onRemove={() => removeParagraph(index)}
                      onMove={(direction) => moveParagraph(index, direction)}
                    />
                  ))}
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addParagraph('text')}
                    >
                      + Texte
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addParagraph('list')}
                    >
                      + Liste
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addParagraph('note')}
                    >
                      + Note
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addParagraph('warning')}
                    >
                      + Avertissement
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addParagraph('example')}
                    >
                      + Exemple
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex gap-2">
                    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <History className="w-4 h-4 mr-1" />
                          Historique
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Historique des versions</DialogTitle>
                          <DialogDescription>
                            Les 2 dernières versions sont conservées.
                          </DialogDescription>
                        </DialogHeader>
                        {historyLoading ? (
                          <p className="text-center py-4 text-muted-foreground">Chargement...</p>
                        ) : history.length === 0 ? (
                          <p className="text-center py-4 text-muted-foreground">
                            Aucun historique disponible.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {history.map((entry) => (
                              <Card key={entry.id} className="p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">Version {entry.version_number}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {entry.content.length} paragraphe(s)
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRestoreVersion(entry)}
                                  >
                                    <RotateCcw className="w-4 h-4 mr-1" />
                                    Restaurer
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette section ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. La section "{section.title || section.section_key}" sera définitivement supprimée.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-1" />
                      Annuler
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-1" />
                      {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                {content.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Aucun contenu. Cliquez sur Éditer pour ajouter du contenu.</p>
                ) : (
                  content.map((paragraph, index) => (
                    <div key={paragraph.id} className="text-sm">
                      {paragraph.type === 'text' && <p>{paragraph.text}</p>}
                      {paragraph.type === 'list' && (
                        <ul className="list-disc pl-5 space-y-1">
                          {paragraph.items?.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      )}
                      {paragraph.type === 'note' && (
                        <div className="bg-primary/10 p-2 rounded border-l-2 border-primary">
                          {paragraph.text}
                        </div>
                      )}
                      {paragraph.type === 'warning' && (
                        <div className="bg-destructive/10 p-2 rounded border-l-2 border-destructive">
                          {paragraph.text}
                        </div>
                      )}
                      {paragraph.type === 'example' && (
                        <div className="bg-muted p-2 rounded italic">
                          {paragraph.text}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <p className="text-xs text-muted-foreground pt-2">
                  Dernière modification: {format(new Date(section.updated_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
