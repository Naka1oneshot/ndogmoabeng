import { useState } from 'react';
import { 
  Trees, Skull, Shield, Waves, Heart,
  ChevronDown, ChevronUp, Coins, Users, 
  Package, Target, Swords,
  Info, AlertTriangle, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AdventureConfig {
  token_policies?: Record<string, { mode: 'INHERIT' | 'FIXED'; fixedValue: number }>;
  adventure_pot?: {
    initialAmount: number;
    currentAmount: number;
  };
  rivieres_penalty?: {
    enabled: boolean;
    minSuccessLevel: number;
    potPenaltyAmount: number;
  };
  foret_monsters?: {
    selected: Array<{
      monster_id: number;
      enabled: boolean;
      pv_max_override: number | null;
      reward_override: number | null;
    }>;
  };
  sheriff_config?: {
    visa_pvic_percent: number;
    duel_max_impact: number;
    cost_per_player: number;
    floor_percent: number;
  };
  lion_config?: {
    timer_enabled: boolean;
    auto_resolve: boolean;
  };
}

interface AdventureTransitionGuideProps {
  config?: AdventureConfig | null;
  adventureSteps?: { game_type_code: string; step_index: number }[];
}

interface GameTypeInit {
  code: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  getTokensDisplay: (config: AdventureConfig | null) => string;
  phase: string;
  getItems: (config: AdventureConfig | null) => string[];
  getSpecial: (config: AdventureConfig | null) => string[];
}

const ROLE_DISTRIBUTION: Record<number, Record<string, number>> = {
  7: { BA: 1, PV: 2, SY: 2, OC: 1, CV: 1 },
  8: { BA: 1, PV: 2, SY: 2, OC: 1, KK: 1, CV: 1 },
  9: { BA: 1, PV: 2, SY: 2, AE: 1, OC: 1, KK: 1, CV: 1 },
};

function getTokenDisplay(config: AdventureConfig | null, gameCode: string, defaultValue: string): string {
  if (!config?.token_policies?.[gameCode]) return defaultValue;
  const policy = config.token_policies[gameCode];
  if (policy.mode === 'INHERIT') {
    return 'Hérité du jeu précédent';
  }
  return `${policy.fixedValue} jetons (fixe)`;
}

const GAME_INITIALIZATIONS: GameTypeInit[] = [
  {
    code: 'RIVIERES',
    name: 'Rivières de Ndogmoabeng',
    icon: <Waves className="h-5 w-5" />,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    getTokensDisplay: (config) => getTokenDisplay(config, 'RIVIERES', '100 jetons'),
    phase: 'DECISIONS',
    getItems: () => [],
    getSpecial: (config) => {
      const specials = [
        'river_session_state (manche 1, niveau 1)',
        'river_player_stats par joueur',
        'Keryndes: pouvoir disponible',
        'Cagnotte initialisée à 0',
      ];
      
      if (config?.rivieres_penalty?.enabled) {
        specials.push(`Pénalité cagnotte: -${config.rivieres_penalty.potPenaltyAmount}€ si niveau < ${config.rivieres_penalty.minSuccessLevel}`);
      }
      
      if (config?.adventure_pot?.initialAmount && config.adventure_pot.initialAmount > 0) {
        specials.push(`Cagnotte aventure: ${config.adventure_pot.initialAmount}€ initial`);
      }
      
      return specials;
    },
  },
  {
    code: 'FORET',
    name: 'Forêt de Ndogmoabeng',
    icon: <Trees className="h-5 w-5" />,
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    getTokensDisplay: (config) => getTokenDisplay(config, 'FORET', '50 jetons'),
    phase: 'PHASE1_MISES',
    getItems: () => [
      'Arme par défaut (+2 si Akandé)',
      'Sniper Akila (clan Akila)',
    ],
    getSpecial: (config) => {
      const specials: string[] = [];
      
      if (config?.foret_monsters?.selected && config.foret_monsters.selected.length > 0) {
        const enabledMonsters = config.foret_monsters.selected.filter(m => m.enabled);
        const customizedMonsters = enabledMonsters.filter(m => m.pv_max_override !== null || m.reward_override !== null);
        
        specials.push(`${enabledMonsters.length} monstres configurés`);
        
        if (customizedMonsters.length > 0) {
          specials.push(`${customizedMonsters.length} monstres avec overrides PV/récompense`);
        }
      } else {
        specials.push('Monstres par défaut (3 en bataille)');
      }
      
      specials.push('Configuration game_monsters');
      specials.push('État game_state_monsters');
      
      return specials;
    },
  },
  {
    code: 'SHERIFF',
    name: 'Shérif de Ndogmoabeng',
    icon: <Shield className="h-5 w-5" />,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    getTokensDisplay: (config) => getTokenDisplay(config, 'SHERIFF', '20 jetons (fixe)'),
    phase: 'PHASE1_CHOICES',
    getItems: () => [],
    getSpecial: (config) => {
      const specials = [
        'sheriff_round_state (pool: 100€)',
        'sheriff_player_choices par joueur',
        'Visa & contrebande à choisir',
      ];
      
      if (config?.sheriff_config) {
        const sc = config.sheriff_config;
        specials.push(`Visa: ${sc.visa_pvic_percent}% des PVic`);
        specials.push(`Impact duel: ±${sc.duel_max_impact} max`);
        specials.push(`Coût par joueur: ${sc.cost_per_player}€`);
        specials.push(`Plancher: ${sc.floor_percent}%`);
      }
      
      return specials;
    },
  },
  {
    code: 'INFECTION',
    name: 'Infection de Ndogmoabeng',
    icon: <Skull className="h-5 w-5" />,
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    getTokensDisplay: (config) => getTokenDisplay(config, 'INFECTION', 'Hérité du jeu précédent'),
    phase: 'OPEN',
    getItems: () => [
      'BA: 1 Balle (max 2)',
      'PV: 1 Balle + 1 Antidote',
      'OC: 1 Boule de cristal',
      'Ezkar: Antidote + Gilet',
      'Équipe: Dose de venin PV',
    ],
    getSpecial: () => [
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
    getTokensDisplay: (config) => getTokenDisplay(config, 'LION', 'Hérité du jeu précédent'),
    phase: 'ACTIVE_TURN',
    getItems: () => [],
    getSpecial: (config) => {
      const specials = [
        'lion_game_state initialisé',
        'Decks de cartes par joueur',
        'Mains de cartes distribuées',
        'Tours alternés entre joueurs',
        'Seul le binôme #1 PVic joue',
      ];
      
      if (config?.lion_config) {
        const lc = config.lion_config;
        if (lc.timer_enabled) {
          specials.push('Timer activé');
        } else {
          specials.push('Timer désactivé');
        }
        if (lc.auto_resolve) {
          specials.push('Résolution automatique');
        } else {
          specials.push('Résolution manuelle');
        }
      }
      
      return specials;
    },
  },
];

export function AdventureTransitionGuide({ config, adventureSteps }: AdventureTransitionGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  // Filter games based on adventure steps if provided
  const displayedGames = adventureSteps && adventureSteps.length > 0
    ? GAME_INITIALIZATIONS.filter(g => adventureSteps.some(s => s.game_type_code === g.code))
        .sort((a, b) => {
          const aStep = adventureSteps.find(s => s.game_type_code === a.code);
          const bStep = adventureSteps.find(s => s.game_type_code === b.code);
          return (aStep?.step_index || 0) - (bStep?.step_index || 0);
        })
    : GAME_INITIALIZATIONS;

  const hasConfig = config !== null && config !== undefined;

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
            {hasConfig && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary">
                <Check className="h-3 w-3 mr-0.5" />
                Config active
              </Badge>
            )}
          </span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-3 space-y-3">
        {!hasConfig && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-2 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Aucune configuration aventure détectée. Valeurs par défaut affichées.
            </p>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground px-1">
          {hasConfig 
            ? 'Voici les initialisations basées sur votre configuration aventure :'
            : 'Voici ce qui est initialisé automatiquement lors du passage à chaque type de jeu :'}
        </p>
        
        <div className="grid gap-2">
          {displayedGames.map((gameInit, index) => (
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
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {index + 1}
                        </Badge>
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
                        <span className="font-medium">{gameInit.getTokensDisplay(config || null)}</span>
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
                    {gameInit.getItems(config || null).length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                          <Package className="h-3.5 w-3.5 text-purple-500" />
                          Inventaire créé
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-0.5 pl-5">
                          {gameInit.getItems(config || null).map((item, idx) => (
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
                        {gameInit.getSpecial(config || null).map((spec, idx) => (
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
