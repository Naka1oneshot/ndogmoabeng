import { useState } from 'react';
import { 
  Trees, Skull, Shield, Waves, Heart,
  ChevronDown, ChevronUp, Coins, Users, 
  Package, Target, Swords,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface GameTypeInit {
  code: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  startingTokens: string;
  phase: string;
  items: string[];
  special: string[];
}

const GAME_INITIALIZATIONS: GameTypeInit[] = [
  {
    code: 'FORET',
    name: 'Forêt de Ndogmoabeng',
    icon: <Trees className="h-5 w-5" />,
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    startingTokens: '50 jetons',
    phase: 'PHASE1_MISES',
    items: [
      'Arme par défaut (+2 si Akandé)',
      'Sniper Akila (clan Akila)',
    ],
    special: [
      'Monstres initialisés (3 en bataille)',
      'Configuration game_monsters',
      'État game_state_monsters',
    ],
  },
  {
    code: 'RIVIERES',
    name: 'Rivières de Ndogmoabeng',
    icon: <Waves className="h-5 w-5" />,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    startingTokens: '100 jetons',
    phase: 'DECISIONS',
    items: [],
    special: [
      'river_session_state (manche 1, niveau 1)',
      'river_player_stats par joueur',
      'Keryndes: pouvoir disponible',
      'Cagnotte initialisée à 0',
    ],
  },
  {
    code: 'SHERIFF',
    name: 'Shérif de Ndogmoabeng',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    startingTokens: '20 jetons (fixe)',
    phase: 'PHASE1_CHOICES',
    items: [],
    special: [
      'sheriff_round_state (pool: 100€)',
      'sheriff_player_choices par joueur',
      'Visa & contrebande à choisir',
    ],
  },
  {
    code: 'INFECTION',
    name: 'Infection de Ndogmoabeng',
    icon: <Skull className="h-5 w-5" />,
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    startingTokens: 'Hérité du jeu précédent',
    phase: 'OPEN',
    items: [
      'BA: 1 Balle (max 2)',
      'PV: 1 Balle + 1 Antidote',
      'OC: 1 Boule de cristal',
      'Ezkar: Antidote + Gilet',
      'Équipe: Dose de venin PV',
    ],
    special: [
      'infection_round_state (manche 1)',
      'Rôles distribués aléatoirement',
      '1 CV reçoit les anticorps',
      'Équipes: PV, SY, CITOYEN, NEUTRE',
    ],
  },
  {
    code: 'LION',
    name: 'Le CŒUR du Lion',
    icon: <Heart className="h-5 w-5" />,
    color: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    startingTokens: 'Hérité du jeu précédent',
    phase: 'ACTIVE_TURN',
    items: [],
    special: [
      'lion_game_state initialisé',
      'Decks de cartes par joueur',
      'Mains de cartes distribuées',
      'Tours alternés entre joueurs',
    ],
  },
];

const ROLE_DISTRIBUTION: Record<number, Record<string, number>> = {
  7: { BA: 1, PV: 2, SY: 2, OC: 1, CV: 1 },
  8: { BA: 1, PV: 2, SY: 2, OC: 1, KK: 1, CV: 1 },
  9: { BA: 1, PV: 2, SY: 2, AE: 1, OC: 1, KK: 1, CV: 1 },
};

export function AdventureTransitionGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-between bg-muted/30 border-dashed"
        >
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Guide des transitions
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground px-1">
          Voici ce qui est initialisé automatiquement lors du passage à chaque type de jeu :
        </p>
        
        <div className="grid gap-2">
          {GAME_INITIALIZATIONS.map((gameInit) => (
            <Card 
              key={gameInit.code} 
              className={`border ${expandedGame === gameInit.code ? 'border-primary/50' : 'border-border/50'} bg-card/50`}
            >
              <Collapsible 
                open={expandedGame === gameInit.code} 
                onOpenChange={(open) => setExpandedGame(open ? gameInit.code : null)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={gameInit.color}>
                          {gameInit.icon}
                        </Badge>
                        <CardTitle className="text-sm font-medium">
                          {gameInit.name}
                        </CardTitle>
                      </div>
                      {expandedGame === gameInit.code ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="p-3 pt-0 space-y-3">
                    {/* Tokens & Phase */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Coins className="h-3.5 w-3.5 text-yellow-500" />
                        <span className="text-muted-foreground">Jetons:</span>
                        <span className="font-medium">{gameInit.startingTokens}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Target className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-muted-foreground">Phase:</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {gameInit.phase}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Items */}
                    {gameInit.items.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                          <Package className="h-3.5 w-3.5 text-purple-500" />
                          Inventaire créé
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-0.5 pl-5">
                          {gameInit.items.map((item, idx) => (
                            <li key={idx} className="list-disc">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Special */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                        <Swords className="h-3.5 w-3.5 text-orange-500" />
                        État initialisé
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5 pl-5">
                        {gameInit.special.map((spec, idx) => (
                          <li key={idx} className="list-disc">{spec}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* INFECTION role distribution */}
                    {gameInit.code === 'INFECTION' && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                          <Users className="h-3.5 w-3.5 text-red-500" />
                          Distribution des rôles
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          {Object.entries(ROLE_DISTRIBUTION).map(([count, roles]) => (
                            <div key={count} className="bg-muted/50 rounded p-1.5">
                              <div className="font-medium text-center mb-1">{count} joueurs</div>
                              <div className="text-muted-foreground text-center">
                                {Object.entries(roles).map(([role, num]) => (
                                  <span key={role} className="inline-block mr-1">
                                    {role}:{num}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
        
        {/* Royaux bonus note */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            <strong>Bonus Royaux:</strong> Les joueurs du clan Royaux reçoivent 1.5× les jetons de départ (sauf SHERIFF).
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
