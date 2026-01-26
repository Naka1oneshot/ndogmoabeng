// Complete narrative texts for adventure cinematics
// Duration formula: base 4s + 0.06s per character (min 6s, max 20s)

export type CinematicSequence = 
  | 'INTRO'
  | 'GUIDE_CHOICE'
  | 'PRE_RIVIERES'
  | 'TRANSITION_1'
  | 'PRE_FORET'
  | 'TRANSITION_2'
  | 'PRE_SHERIFF'
  | 'TRANSITION_3'
  | 'PRE_INFECTION'
  | 'END';

export interface SequenceContent {
  title: string;
  narrative: string;
  showClans?: boolean;
}

export const SEQUENCE_NARRATIVES: Record<CinematicSequence, SequenceContent> = {
  INTRO: {
    title: 'La Carte Trouvée',
    narrative: `Une carte oubliée a refait surface.
Elle mène au Centre de Ndogmoabeng… là où un trésor ancien attend celui qui saura franchir les épreuves.

Ce soir, vous êtes des explorateurs : en binômes, vous suivrez la route de la carte, guidés par un compagnon choisi parmi les clans du village.`,
  },
  GUIDE_CHOICE: {
    title: 'Les Guides du Village',
    narrative: `Avant de partir, choisissez votre guide.
Son clan peut influencer votre chance, vos ressources, ou votre manière de traverser Ndogmoabeng.`,
    showClans: true,
  },
  PRE_RIVIERES: {
    title: 'Les Rivières du Nord',
    narrative: `L'expédition commence au nord, dans le froid et les vents.
Pour atteindre Ndogmoabeng, il faut d'abord survivre aux eaux et aux dangers qui montent à chaque étape.`,
  },
  TRANSITION_1: {
    title: 'Transition',
    narrative: `Vous touchez enfin la terre ferme.
Un verrou est tombé… mais la route vers le Centre ne fait que commencer.`,
  },
  PRE_FORET: {
    title: 'La Forêt de Ndogmoabeng',
    narrative: `La forêt de Ndogmoabeng barre le chemin.
On la traverse rarement sans perdre quelque chose : du temps, des ressources… ou des certitudes.`,
  },
  TRANSITION_2: {
    title: 'Aux Portes du Centre',
    narrative: `Vous sortez des arbres et apercevez les portes du Centre.
Elles sont proches… mais elles ne s'ouvrent pas pour tout le monde.`,
  },
  PRE_SHERIFF: {
    title: 'Le Shérif de Ndogmoabeng',
    narrative: `Pour entrer au Centre, il faut un visa.
Le Shérif contrôle vos droits, vos jetons, et vos choix.
Ici, chaque avantage a un prix.`,
  },
  TRANSITION_3: {
    title: 'Le Calme Avant la Tempête',
    narrative: `Les portes cèdent.
Vous entrez au cœur de Ndogmoabeng.
Une auberge vous accueille… et la nuit semble enfin calme.`,
  },
  PRE_INFECTION: {
    title: 'Infection à Ndogmoabeng',
    narrative: `Au matin, tout bascule.
Une crise éclate, ciblant les visiteurs.
La peur se propage, la confiance se brise, et votre expédition devient une lutte de survie.`,
  },
  END: {
    title: 'Fin de l\'Aventure',
    narrative: `À l'issue des épreuves, le duo qui cumule le plus de points gagne le privilège final : accéder au trésor.
Mais à Ndogmoabeng, le dernier choix est toujours le même… rester unis, ou se trahir.`,
  },
};

// Calculate duration based on text length
export function calculateSequenceDuration(sequence: CinematicSequence): number {
  const content = SEQUENCE_NARRATIVES[sequence];
  const textLength = content.narrative.length;
  
  // Base 4s + 0.06s per character
  const calculatedDuration = 4000 + (textLength * 60);
  
  // Clamp between 6s and 20s
  // Add extra time for GUIDE_CHOICE which shows clan cards
  const extraTime = content.showClans ? 4000 : 0;
  
  return Math.max(6000, Math.min(20000, calculatedDuration)) + extraTime;
}

// Get sequence for game type (centralized mapping)
export function getSequenceForGameType(
  gameTypeCode: string | null,
  isStart: boolean = true
): CinematicSequence[] {
  switch (gameTypeCode) {
    case 'RIVIERES':
      return isStart ? ['INTRO', 'GUIDE_CHOICE', 'PRE_RIVIERES'] : [];
    case 'FORET':
      return isStart ? ['TRANSITION_1', 'PRE_FORET'] : [];
    case 'SHERIFF':
      return isStart ? ['TRANSITION_2', 'PRE_SHERIFF'] : [];
    case 'INFECTION':
      return isStart ? ['TRANSITION_3', 'PRE_INFECTION'] : [];
    default:
      return [];
  }
}

export function getEndSequence(): CinematicSequence[] {
  return ['END'];
}
