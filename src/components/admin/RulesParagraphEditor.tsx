import { ArrowUp, ArrowDown, Trash2, Type, List, AlertCircle, Lightbulb, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RulesParagraph } from '@/hooks/useGameRulesContent';
import { Badge } from '@/components/ui/badge';

interface RulesParagraphEditorProps {
  paragraph: RulesParagraph;
  index: number;
  total: number;
  onUpdate: (updates: Partial<RulesParagraph>) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
}

const TYPE_CONFIG = {
  text: { label: 'Texte', icon: Type, color: 'bg-blue-500/10 text-blue-500' },
  list: { label: 'Liste', icon: List, color: 'bg-green-500/10 text-green-500' },
  note: { label: 'Note', icon: Lightbulb, color: 'bg-primary/10 text-primary' },
  warning: { label: 'Avertissement', icon: AlertCircle, color: 'bg-destructive/10 text-destructive' },
  example: { label: 'Exemple', icon: FileText, color: 'bg-muted text-muted-foreground' },
};

export function RulesParagraphEditor({
  paragraph,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: RulesParagraphEditorProps) {
  const config = TYPE_CONFIG[paragraph.type];
  const Icon = config.icon;

  const handleListItemChange = (itemIndex: number, value: string) => {
    const newItems = [...(paragraph.items || [])];
    newItems[itemIndex] = value;
    onUpdate({ items: newItems });
  };

  const addListItem = () => {
    onUpdate({ items: [...(paragraph.items || []), ''] });
  };

  const removeListItem = (itemIndex: number) => {
    const newItems = (paragraph.items || []).filter((_, i) => i !== itemIndex);
    onUpdate({ items: newItems });
  };

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between">
        <Badge className={config.color}>
          <Icon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onMove('up')}
            disabled={index === 0}
          >
            <ArrowUp className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onMove('down')}
            disabled={index === total - 1}
          >
            <ArrowDown className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {paragraph.type === 'list' ? (
        <div className="space-y-2">
          {(paragraph.items || []).map((item, itemIndex) => (
            <div key={itemIndex} className="flex items-center gap-2">
              <span className="text-muted-foreground">•</span>
              <Input
                value={item}
                onChange={(e) => handleListItemChange(itemIndex, e.target.value)}
                placeholder={`Élément ${itemIndex + 1}`}
                className="flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeListItem(itemIndex)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={addListItem}
            className="w-full"
          >
            + Ajouter un élément
          </Button>
        </div>
      ) : (
        <Textarea
          value={paragraph.text || ''}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder="Entrez le texte..."
          rows={3}
        />
      )}
    </div>
  );
}
