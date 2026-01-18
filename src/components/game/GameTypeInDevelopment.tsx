import { Construction, ChevronLeft } from 'lucide-react';
import { ForestButton } from '@/components/ui/ForestButton';
import { Badge } from '@/components/ui/badge';

interface GameTypeInDevelopmentProps {
  gameTypeCode: string | null;
  onBack?: () => void;
  showBackButton?: boolean;
}

const GAME_TYPE_NAMES: Record<string, string> = {
  FORET: 'La Forêt',
  RIVIERES: 'Les Rivières',
  INFECTION: 'Infection',
};

export function GameTypeInDevelopment({ 
  gameTypeCode, 
  onBack, 
  showBackButton = true 
}: GameTypeInDevelopmentProps) {
  const gameTypeName = gameTypeCode ? GAME_TYPE_NAMES[gameTypeCode] || gameTypeCode : 'Ce jeu';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="card-gradient rounded-xl border border-border p-8 max-w-md w-full space-y-6">
        <div className="flex justify-center">
          <div className="relative">
            <Construction className="h-16 w-16 text-amber-400 animate-pulse" />
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 rounded-full animate-ping" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/30 text-sm px-3 py-1">
            {gameTypeName}
          </Badge>
          <h2 className="font-display text-xl text-foreground">
            En cours de développement
          </h2>
        </div>
        
        <p className="text-muted-foreground leading-relaxed">
          Ce type de jeu n'est pas encore disponible. 
          L'équipe travaille activement sur son implémentation. 
          Revenez bientôt pour découvrir cette nouvelle aventure !
        </p>
        
        <div className="pt-2 space-y-3">
          <div className="text-sm text-muted-foreground/70">
            <span className="font-medium text-primary">Seul "La Forêt"</span> est actuellement jouable.
          </div>
          
          {showBackButton && onBack && (
            <ForestButton onClick={onBack} variant="outline" className="w-full">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Retour
            </ForestButton>
          )}
        </div>
      </div>
    </div>
  );
}
