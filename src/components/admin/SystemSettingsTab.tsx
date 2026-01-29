import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSystemSettings, ChatConfig } from '@/hooks/useSystemSettings';
import { toast } from '@/hooks/use-toast';
import { 
  MessageCircle, 
  Users, 
  Gamepad2, 
  Save, 
  Loader2,
  Settings,
  Hash
} from 'lucide-react';

export function SystemSettingsTab() {
  const { chatConfig, loading, updateChatConfig } = useSystemSettings();
  const [localConfig, setLocalConfig] = useState<ChatConfig | null>(null);
  const [saving, setSaving] = useState(false);

  // Use local state if modified, otherwise use fetched config
  const config = localConfig || chatConfig;

  const handleToggle = (key: keyof ChatConfig) => {
    const newConfig = { ...config, [key]: !config[key] };
    setLocalConfig(newConfig);
  };

  const handleMaxMessagesChange = (value: number) => {
    const newConfig = { ...config, max_messages_per_game: value };
    setLocalConfig(newConfig);
  };

  const handleSave = async () => {
    if (!localConfig) return;
    
    setSaving(true);
    const { error } = await updateChatConfig(localConfig);
    setSaving(false);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Paramètres sauvegardés",
        description: "Les paramètres système ont été mis à jour",
      });
      setLocalConfig(null);
    }
  };

  const hasChanges = localConfig !== null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-accent/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent" />
            Configuration des Chats
          </CardTitle>
          <CardDescription>
            Activer ou désactiver les différents types de chat sur la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* General Chat Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="general-chat" className="text-base font-medium">
                  Chat Général (Amis)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Messages privés entre amis
                </p>
              </div>
            </div>
            <Switch
              id="general-chat"
              checked={config.general_chat_enabled}
              onCheckedChange={() => handleToggle('general_chat_enabled')}
            />
          </div>

          <Separator />

          {/* Lobby Chat Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Users className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <Label htmlFor="lobby-chat" className="text-base font-medium">
                  Chat Lobby
                </Label>
                <p className="text-sm text-muted-foreground">
                  Messages dans la salle d'attente avant une partie
                </p>
              </div>
            </div>
            <Switch
              id="lobby-chat"
              checked={config.lobby_chat_enabled}
              onCheckedChange={() => handleToggle('lobby_chat_enabled')}
            />
          </div>

          <Separator />

          {/* In-Game Chat Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Gamepad2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <Label htmlFor="ingame-chat" className="text-base font-medium">
                  Chat In-Game
                </Label>
                <p className="text-sm text-muted-foreground">
                  Messages pendant une partie en cours
                </p>
              </div>
            </div>
            <Switch
              id="ingame-chat"
              checked={config.ingame_chat_enabled}
              onCheckedChange={() => handleToggle('ingame_chat_enabled')}
            />
          </div>

          <Separator />

          {/* Max Messages per Game */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Hash className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <Label htmlFor="max-messages" className="text-base font-medium">
                  Messages max par partie
                </Label>
                <p className="text-sm text-muted-foreground">
                  Limite de messages qu'un joueur peut envoyer par partie
                </p>
              </div>
            </div>
            <Input
              id="max-messages"
              type="number"
              min={10}
              max={1000}
              value={config.max_messages_per_game}
              onChange={(e) => handleMaxMessagesChange(Number(e.target.value))}
              className="w-24 text-center"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-accent hover:bg-accent/90"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Sauvegarder les modifications
          </Button>
        </div>
      )}

      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">État actuel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${config.general_chat_enabled ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Chat Général</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${config.lobby_chat_enabled ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Chat Lobby</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${config.ingame_chat_enabled ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>Chat In-Game</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="w-3 h-3 text-muted-foreground" />
              <span>{config.max_messages_per_game} msg/partie</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
