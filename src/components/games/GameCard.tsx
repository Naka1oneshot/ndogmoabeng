import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ForestButton } from '@/components/ui/ForestButton';
import { MapPin, Users, UsersRound, BookOpen, Gamepad2, Pencil } from 'lucide-react';
import { GameTypeData } from '@/hooks/useGameTypes';
import defaultLogo from '@/assets/logo-ndogmoabeng.png';

// Static images fallback
import rivieresImage from '@/assets/games/rivieres-ndogmoabeng.png';
import foretImage from '@/assets/games/foret-ndogmoabeng.png';
import infectionImage from '@/assets/games/infection-ndogmoabeng.png';
import villageImage from '@/assets/games/village-ndogmoabeng.png';
import lionImage from '@/assets/games/lion-ndogmoabeng.png';

const STATIC_IMAGES: Record<string, string> = {
  RIVIERES: rivieresImage,
  FORET: foretImage,
  INFECTION: infectionImage,
  SHERIFF: villageImage,
  LION: lionImage,
};

const IMAGE_POSITIONS: Record<string, string> = {
  RIVIERES: 'object-top',
  FORET: 'object-center',
  INFECTION: 'object-center',
  SHERIFF: 'object-center',
  LION: 'object-center',
};

interface GameCardProps {
  game: GameTypeData;
  onRulesClick: (code: string) => void;
  onCreateGame: (code: string) => void;
  onEditClick?: (game: GameTypeData) => void;
  isAdmin?: boolean;
}

export function GameCard({ game, onRulesClick, onCreateGame, onEditClick, isAdmin }: GameCardProps) {
  // Use image_url from DB, then static fallback, then default logo
  const imageUrl = game.image_url || STATIC_IMAGES[game.code] || defaultLogo;
  const imagePosition = IMAGE_POSITIONS[game.code] || 'object-center';
  
  // Check if using default logo (no image at all)
  const isDefaultLogo = !game.image_url && !STATIC_IMAGES[game.code];

  return (
    <Card className="card-gradient border-border/50 hover:border-primary/50 transition-colors group overflow-hidden relative">
      {isAdmin && onEditClick && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 z-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onEditClick(game)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {/* Game image */}
      <div className="aspect-[3/4] relative overflow-hidden">
        <img 
          src={imageUrl} 
          alt={game.name} 
          className={`w-full h-full ${isDefaultLogo ? 'object-contain p-8 bg-muted/50' : 'object-cover'} group-hover:scale-105 transition-transform duration-300 ${!isDefaultLogo ? imagePosition : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      </div>

      <CardHeader className="pb-2">
        {game.tagline && (
          <Badge variant="outline" className="w-fit mb-2 text-primary border-primary/50">
            {game.tagline}
          </Badge>
        )}
        <h3 className="font-display text-xl">
          {game.name}
        </h3>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <UsersRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <span className="text-foreground font-medium">{game.min_players} joueurs minimum</span>
        </div>
        {game.lieu && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{game.lieu}</span>
          </div>
        )}
        {game.clan && (
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{game.clan}</span>
          </div>
        )}
        {game.personnages && game.personnages.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {game.personnages.slice(0, 3).map((p, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {p}
              </Badge>
            ))}
            {game.personnages.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{game.personnages.length - 3}
              </Badge>
            )}
          </div>
        )}
        {game.objet_cle && (
          <p className="text-primary/80 italic text-sm">
            "{game.objet_cle}"
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full gap-2"
          onClick={() => onRulesClick(game.code)}
        >
          <BookOpen className="h-4 w-4" />
          Voir règles
        </Button>
        <ForestButton 
          className="w-full"
          onClick={() => onCreateGame(game.code)}
        >
          <Gamepad2 className="h-4 w-4" />
          Créer une partie
        </ForestButton>
      </CardFooter>
    </Card>
  );
}
