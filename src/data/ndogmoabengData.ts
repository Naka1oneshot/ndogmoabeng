// Configuration centralisée pour les données Ndogmoabeng
// Les images peuvent être remplacées facilement en modifiant les chemins ci-dessous

export interface GameData {
  id: string;
  code: string;
  name: string;
  tagline: string;
  lieu: string;
  clan: string;
  personnages?: string[];
  objetCle?: string;
  image: string;
  minPlayers: number;
}

export interface ClanData {
  id: string;
  name: string;
  description: string;
  devise: string;
  image: string;
}

export const GAMES_DATA: GameData[] = [
  {
    id: 'rivieres',
    code: 'RIVIERES',
    name: 'Les rivières de Ndogmoabeng',
    tagline: 'Le bateau en faillite',
    lieu: 'Les Rivières du nord de Ndogmoabeng',
    clan: 'Maison des Keryndes',
    personnages: ['Capitaine du nord'],
    image: '/placeholder.svg',
    minPlayers: 2,
  },
  {
    id: 'foret',
    code: 'FORET',
    name: 'La forêt de Ndogmoabeng',
    tagline: 'La traversée',
    lieu: 'Les forêts autour du centre',
    clan: 'Cercle d\'Aséyra',
    objetCle: 'L\'Essence de Ndogmoabeng',
    image: '/placeholder.svg',
    minPlayers: 2,
  },
  {
    id: 'infection',
    code: 'INFECTION',
    name: 'Infection à Ndogmoabeng',
    tagline: 'La contamination',
    lieu: 'Centre du village',
    clan: 'La ligue d\'Ezkar',
    personnages: ['Bras armé', 'Capitaine du nord', 'Sans cercle', 'Oeil du crépuscule', 'Synthétiste'],
    image: '/placeholder.svg',
    minPlayers: 7,
  },
];

export const CLANS_DATA: ClanData[] = [
  {
    id: 'maison-royale',
    name: 'Maison Royale',
    description: 'Gouvernent le village… archives officielles et cérémonies.',
    devise: 'L\'histoire s\'écrit ici.',
    image: '/placeholder.svg',
  },
  {
    id: 'fraternite-zoulous',
    name: 'Fraternité Zoulous',
    description: 'Marchands influents… neutralité stratégique.',
    devise: 'Monnaie et héritage.',
    image: '/placeholder.svg',
  },
  {
    id: 'maison-keryndes',
    name: 'Maison des Keryndes',
    description: 'Guides, messagers… maîtres des passages.',
    devise: 'On part, on revient.',
    image: '/placeholder.svg',
  },
  {
    id: 'akande',
    name: 'Akandé',
    description: 'Armée de Ndogmoabeng… prêts au sacrifice.',
    devise: 'Tenir ou mourir.',
    image: '/placeholder.svg',
  },
  {
    id: 'cercle-aseyra',
    name: 'Cercle d\'Aséyra',
    description: 'Gardiens de la vraie histoire… archives alternatives.',
    devise: 'Si l\'histoire se tord, on la redresse.',
    image: '/placeholder.svg',
  },
  {
    id: 'sources-akila',
    name: 'Les Sources d\'Akila',
    description: 'Science, soin… transformer l\'inconnu en protocole.',
    devise: 'Mesurer pour guérir.',
    image: '/placeholder.svg',
  },
  {
    id: 'ezkar',
    name: 'Ezkar',
    description: 'Briseurs / saboteurs… fractures volontaires.',
    devise: 'Briser pour révéler.',
    image: '/placeholder.svg',
  },
];

export const LORE = {
  title: 'L\'Essence de Ndogmoabeng',
  subtitle: 'Une tradition mythique censée ouvrir les portes de la mémoire et de la vérité.',
  description: [
    'Au cœur du village de Ndogmoabeng, sept clans coexistent dans un équilibre fragile.',
    'Chaque clan porte une vision de l\'histoire et des secrets ancestraux.',
    'L\'Essence de Ndogmoabeng est le rituel sacré qui révèle la vérité cachée.',
    'Les épreuves des rivières, de la forêt et du village testent la loyauté de chacun.',
    'Seuls ceux qui affrontent leurs choix découvriront ce que cache la mémoire collective.',
  ],
};
