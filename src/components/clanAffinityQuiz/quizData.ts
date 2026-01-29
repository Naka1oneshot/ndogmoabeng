// Clan affinity quiz data - DO NOT MODIFY QUESTION TEXTS

export const CLAN_CODES = ['ROY', 'ZOU', 'KER', 'AKA', 'ASE', 'AKI', 'EZK'] as const;
export type ClanCode = typeof CLAN_CODES[number];

export interface ClanInfo {
  id: string;
  label: string;
  color: string;
  bgGradient: string;
  interpretation: string;
}

export const CLAN_MAP: Record<ClanCode, ClanInfo> = {
  ROY: {
    id: 'maison-royale',
    label: 'Royaux',
    color: 'amber',
    bgGradient: 'from-amber-500/20 via-amber-600/10 to-amber-700/5',
    interpretation: 'Tu valorises la stabilité, l\'ordre et la légitimité. Tu cherches à maintenir les structures établies.',
  },
  ZOU: {
    id: 'fraternite-zoulous',
    label: 'Zoulous',
    color: 'emerald',
    bgGradient: 'from-emerald-500/20 via-emerald-600/10 to-emerald-700/5',
    interpretation: 'Tu privilégies le compromis, l\'équilibre et les alliances. La diplomatie est ta force.',
  },
  KER: {
    id: 'maison-keryndes',
    label: 'Keryndes',
    color: 'sky',
    bgGradient: 'from-sky-500/20 via-sky-600/10 to-sky-700/5',
    interpretation: 'Tu excelles dans l\'adaptation et le mouvement. Les routes et la liberté te définissent.',
  },
  AKA: {
    id: 'akande',
    label: 'Akandé',
    color: 'red',
    bgGradient: 'from-red-500/20 via-red-600/10 to-red-700/5',
    interpretation: 'Tu places la protection et la sécurité au centre. La discipline guide tes actions.',
  },
  ASE: {
    id: 'cercle-aseyra',
    label: 'Aséyra',
    color: 'purple',
    bgGradient: 'from-purple-500/20 via-purple-600/10 to-purple-700/5',
    interpretation: 'Tu es gardien de la mémoire et de la vérité. La transmission du savoir t\'est essentielle.',
  },
  AKI: {
    id: 'sources-akila',
    label: 'Akila',
    color: 'teal',
    bgGradient: 'from-teal-500/20 via-teal-600/10 to-teal-700/5',
    interpretation: 'Tu te consacres au soin et à l\'amélioration. La résilience et la compassion te caractérisent.',
  },
  EZK: {
    id: 'ezkar',
    label: 'Ezkar',
    color: 'orange',
    bgGradient: 'from-orange-500/20 via-orange-600/10 to-orange-700/5',
    interpretation: 'Tu luttes pour la justice et la rupture avec l\'oppression. La démocratie est ton idéal.',
  },
};

export interface QuizOption {
  clanCode: ClanCode;
  text: string;
}

export interface QuizQuestion {
  id: number;
  text: string;
  options: QuizOption[];
}

// 25 questions bank - EXACT TEXTS FROM SPEC
export const BANK_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: "Face à l'injustice d'une décision royale, tu fais quoi ?",
    options: [
      { clanCode: 'ROY', text: "Je la respecte : la stabilité d'abord" },
      { clanCode: 'ZOU', text: "Je négocie un compromis pour éviter le chaos" },
      { clanCode: 'KER', text: "Je cherche une alternative discrète, un détour" },
      { clanCode: 'AKA', text: "Je sécurise les personnes avant tout" },
      { clanCode: 'ASE', text: "Je conserve la trace pour que la mémoire survive" },
      { clanCode: 'AKI', text: "Je m'occupe des blessés et des conséquences humaines" },
      { clanCode: 'EZK', text: "Je veux renverser le système pour instaurer la démocratie" },
    ],
  },
  {
    id: 4,
    text: "Tu réussis surtout grâce à…",
    options: [
      { clanCode: 'ROY', text: "L'autorité et la légitimité" },
      { clanCode: 'ZOU', text: "La diplomatie et les alliances" },
      { clanCode: 'KER', text: "L'adaptation et l'orientation" },
      { clanCode: 'AKA', text: "La discipline et la protection" },
      { clanCode: 'ASE', text: "La connaissance et la mémoire" },
      { clanCode: 'AKI', text: "La maîtrise du vivant et la résilience" },
      { clanCode: 'EZK', text: "La rupture et l'action politique" },
    ],
  },
  {
    id: 5,
    text: 'Qu\'est-ce que "la vérité" pour toi ?',
    options: [
      { clanCode: 'ROY', text: "Ce qui maintient l'ordre" },
      { clanCode: 'ZOU', text: "Ce qui évite la guerre" },
      { clanCode: 'KER', text: "Ce qui permet de survivre sur la route" },
      { clanCode: 'AKA', text: "Ce qui protège le village" },
      { clanCode: 'ASE', text: "Ce qui doit être transmis sans perte" },
      { clanCode: 'AKI', text: "Ce qui sauve des vies" },
      { clanCode: 'EZK', text: "Ce qui libère le peuple" },
    ],
  },
  {
    id: 7,
    text: "Ton style en conflit ?",
    options: [
      { clanCode: 'ROY', text: "Décision officielle" },
      { clanCode: 'ZOU', text: "Accord et contreparties" },
      { clanCode: 'KER', text: "Manœuvre et déplacement" },
      { clanCode: 'AKA', text: "Front et protection" },
      { clanCode: 'ASE', text: "Information et révélation" },
      { clanCode: 'AKI', text: "Assistance et optimisation des forces" },
      { clanCode: 'EZK', text: "Sabotage et mobilisation" },
    ],
  },
  {
    id: 8,
    text: "Ce que tu redoutes le plus ?",
    options: [
      { clanCode: 'ROY', text: "Le vide d'autorité" },
      { clanCode: 'ZOU', text: "Le déséquilibre des forces" },
      { clanCode: 'KER', text: "Être enfermé / bloqué" },
      { clanCode: 'AKA', text: "Une faille dans la défense" },
      { clanCode: 'ASE', text: "L'oubli de la vérité" },
      { clanCode: 'AKI', text: "L'impuissance face à la mort" },
      { clanCode: 'EZK', text: "L'inertie face à l'oppression" },
    ],
  },
  {
    id: 10,
    text: "Ton but final ?",
    options: [
      { clanCode: 'ROY', text: "Préserver la royauté" },
      { clanCode: 'ZOU', text: "Garder l'équilibre entre clans" },
      { clanCode: 'KER', text: "Garder le contrôle des routes" },
      { clanCode: 'AKA', text: "Garantir la sécurité du centre" },
      { clanCode: 'ASE', text: "Protéger la mémoire complète" },
      { clanCode: 'AKI', text: "Protéger la vie et renforcer les alliés" },
      { clanCode: 'EZK', text: "Abolir la royauté pour instaurer la démocratie" },
    ],
  },
  {
    id: 11,
    text: "Quand un secret peut déclencher une guerre…",
    options: [
      { clanCode: 'ROY', text: "Je le scelle" },
      { clanCode: 'ZOU', text: "Je le monnaye en paix" },
      { clanCode: 'KER', text: "Je le déplace loin des regards" },
      { clanCode: 'AKA', text: "Je le protège" },
      { clanCode: 'ASE', text: "Je l'archive" },
      { clanCode: 'AKI', text: "Je mesure son impact humain" },
      { clanCode: 'EZK', text: "Je le révèle pour faire bouger le système" },
    ],
  },
  {
    id: 12,
    text: "Un accès illégal aux archives est découvert :",
    options: [
      { clanCode: 'ROY', text: "Procès et sanction" },
      { clanCode: 'ZOU', text: "Négociation discrète, éviter l'explosion" },
      { clanCode: 'KER', text: "Extraire la personne par un passage sûr" },
      { clanCode: 'AKA', text: "Neutraliser la menace" },
      { clanCode: 'ASE', text: "Comprendre ce qui a été vu et consigné" },
      { clanCode: 'AKI', text: "S'assurer qu'il n'y a pas de victimes" },
      { clanCode: 'EZK', text: "Utiliser l'affaire pour attaquer la royauté" },
    ],
  },
  {
    id: 13,
    text: "Ton rôle naturel dans une équipe :",
    options: [
      { clanCode: 'ROY', text: "Chef légitime" },
      { clanCode: 'ZOU', text: "Médiateur" },
      { clanCode: 'KER', text: "Éclaireur" },
      { clanCode: 'AKA', text: "Gardien" },
      { clanCode: 'ASE', text: "Archiviste / stratège du savoir" },
      { clanCode: 'AKI', text: "Soutien / optimiseur" },
      { clanCode: 'EZK', text: "Agitateur / révolutionnaire" },
    ],
  },
  {
    id: 14,
    text: "Tu fais confiance surtout à…",
    options: [
      { clanCode: 'ROY', text: "La loi du centre" },
      { clanCode: 'ZOU', text: "Les dettes morales et accords" },
      { clanCode: 'KER', text: "Les signes du terrain" },
      { clanCode: 'AKA', text: "Les protocoles et la force" },
      { clanCode: 'ASE', text: "Les rites et la mémoire" },
      { clanCode: 'AKI', text: "Les preuves biologiques / effets" },
      { clanCode: 'EZK', text: "Le mouvement populaire" },
    ],
  },
  {
    id: 15,
    text: "Ton approche de l'inconnu :",
    options: [
      { clanCode: 'ROY', text: "Encadrer" },
      { clanCode: 'ZOU', text: "Négocier" },
      { clanCode: 'KER', text: "Explorer" },
      { clanCode: 'AKA', text: "Sécuriser" },
      { clanCode: 'ASE', text: "Interpréter" },
      { clanCode: 'AKI', text: "Tester / soigner / améliorer" },
      { clanCode: 'EZK', text: "Renverser" },
    ],
  },
  {
    id: 16,
    text: "Une route devient impraticable :",
    options: [
      { clanCode: 'ROY', text: "Décret et fermeture" },
      { clanCode: 'ZOU', text: "Redistribution des flux" },
      { clanCode: 'KER', text: "Nouvelle route, contournement" },
      { clanCode: 'AKA', text: "Barrages et contrôle" },
      { clanCode: 'ASE', text: "Étude des causes sur le long terme" },
      { clanCode: 'AKI', text: "Gestion des blessés/logistique" },
      { clanCode: 'EZK', text: "Profiter du chaos pour pousser la révolte" },
    ],
  },
  {
    id: 17,
    text: "Ta plus grande force personnelle :",
    options: [
      { clanCode: 'ROY', text: "Autorité" },
      { clanCode: 'ZOU', text: "Influence" },
      { clanCode: 'KER', text: "Orientation" },
      { clanCode: 'AKA', text: "Courage" },
      { clanCode: 'ASE', text: "Mémoire" },
      { clanCode: 'AKI', text: "Résilience" },
      { clanCode: 'EZK', text: "Détermination politique" },
    ],
  },
  {
    id: 18,
    text: "Ton plus grand défaut probable :",
    options: [
      { clanCode: 'ROY', text: "Rigidité" },
      { clanCode: 'ZOU', text: "Calcul permanent" },
      { clanCode: 'KER', text: "Fuite / distance" },
      { clanCode: 'AKA', text: "Dureté" },
      { clanCode: 'ASE', text: "Obsession de la vérité" },
      { clanCode: 'AKI', text: "Surprotection" },
      { clanCode: 'EZK', text: "Radicalité" },
    ],
  },
  {
    id: 19,
    text: "Quand tu dois choisir :",
    options: [
      { clanCode: 'ROY', text: "Ordre > vérité" },
      { clanCode: 'ZOU', text: "Paix > orgueil" },
      { clanCode: 'KER', text: "Survie > confrontation" },
      { clanCode: 'AKA', text: "Protection > liberté" },
      { clanCode: 'ASE', text: "Vérité > confort" },
      { clanCode: 'AKI', text: "Vie > règles" },
      { clanCode: 'EZK', text: "Justice > stabilité" },
    ],
  },
  {
    id: 20,
    text: 'Dans une crise "terroriste" :',
    options: [
      { clanCode: 'ROY', text: "Renforcer la légitimité du pouvoir" },
      { clanCode: 'ZOU', text: "Éviter la guerre civile" },
      { clanCode: 'KER', text: "Contrôler les itinéraires" },
      { clanCode: 'AKA', text: "Fermer, filtrer, contenir" },
      { clanCode: 'ASE', text: "Démêler manipulation et réalité" },
      { clanCode: 'AKI', text: "Soigner, soutenir, reconstruire" },
      { clanCode: 'EZK', text: "Transformer la peur en révolution" },
    ],
  },
  {
    id: 21,
    text: "Le savoir est d'abord…",
    options: [
      { clanCode: 'ROY', text: "Un outil de gouvernance" },
      { clanCode: 'ZOU', text: "Une monnaie d'échange" },
      { clanCode: 'KER', text: "Une carte mentale" },
      { clanCode: 'AKA', text: "Un avantage stratégique" },
      { clanCode: 'ASE', text: "Une responsabilité sacrée" },
      { clanCode: 'AKI', text: "Une méthode pour sauver" },
      { clanCode: 'EZK', text: "Une arme contre l'oppression" },
    ],
  },
  {
    id: 23,
    text: "Ce qui te motive le plus :",
    options: [
      { clanCode: 'ROY', text: "Héritage" },
      { clanCode: 'ZOU', text: "Équilibre" },
      { clanCode: 'KER', text: "Liberté de mouvement" },
      { clanCode: 'AKA', text: "Devoir" },
      { clanCode: 'ASE', text: "Mémoire" },
      { clanCode: 'AKI', text: "Compassion + efficacité" },
      { clanCode: 'EZK', text: "Liberté politique" },
    ],
  },
  {
    id: 24,
    text: "Ta méthode pour convaincre :",
    options: [
      { clanCode: 'ROY', text: "Autorité" },
      { clanCode: 'ZOU', text: "Accord gagnant-gagnant" },
      { clanCode: 'KER', text: "Preuve par l'expérience" },
      { clanCode: 'AKA', text: "Preuve par la force/discipline" },
      { clanCode: 'ASE', text: "Preuve par les récits/archives" },
      { clanCode: 'AKI', text: "Preuve par les résultats concrets" },
      { clanCode: 'EZK', text: "Discours de rupture" },
    ],
  },
  {
    id: 25,
    text: "La royauté, pour toi :",
    options: [
      { clanCode: 'ROY', text: "Nécessaire" },
      { clanCode: 'ZOU', text: "Utile si équilibrée" },
      { clanCode: 'KER', text: "Lointaine" },
      { clanCode: 'AKA', text: "Acceptable si protectrice" },
      { clanCode: 'ASE', text: "Danger si elle contrôle la vérité" },
      { clanCode: 'AKI', text: "Secondaire face aux vies" },
      { clanCode: 'EZK', text: "À abolir" },
    ],
  },
  {
    id: 26,
    text: "Ton rapport aux règles :",
    options: [
      { clanCode: 'ROY', text: "Je les écris/les applique" },
      { clanCode: 'ZOU', text: "Je les utilise pour pacifier" },
      { clanCode: 'KER', text: "Je les contourne intelligemment" },
      { clanCode: 'AKA', text: "Je les fais respecter" },
      { clanCode: 'ASE', text: "Je les compare à l'histoire" },
      { clanCode: 'AKI', text: "Je les adapte au vivant" },
      { clanCode: 'EZK', text: "Je les combats si injustes" },
    ],
  },
  {
    id: 27,
    text: "Tu préfères agir :",
    options: [
      { clanCode: 'ROY', text: "À découvert" },
      { clanCode: 'ZOU', text: "Par réseau" },
      { clanCode: 'KER', text: "En mouvement" },
      { clanCode: 'AKA', text: "En position" },
      { clanCode: 'ASE', text: "Dans l'ombre des archives/rituels" },
      { clanCode: 'AKI', text: "En soutien discret" },
      { clanCode: 'EZK', text: "En cellule clandestine" },
    ],
  },
  {
    id: 28,
    text: "Ta phrase-réflexe :",
    options: [
      { clanCode: 'ROY', text: '"Il faut une décision."' },
      { clanCode: 'ZOU', text: '"On peut trouver un accord."' },
      { clanCode: 'KER', text: '"On prend une autre route."' },
      { clanCode: 'AKA', text: '"On sécurise."' },
      { clanCode: 'ASE', text: '"On doit se souvenir."' },
      { clanCode: 'AKI', text: '"On va vous relever."' },
      { clanCode: 'EZK', text: '"On renverse l\'injustice."' },
    ],
  },
  {
    id: 29,
    text: "Ton rapport au secret :",
    options: [
      { clanCode: 'ROY', text: "Nécessaire au pouvoir" },
      { clanCode: 'ZOU', text: "Utile à l'équilibre" },
      { clanCode: 'KER', text: "Utile à la survie" },
      { clanCode: 'AKA', text: "Indispensable à la sécurité" },
      { clanCode: 'ASE', text: "Dangereux s'il efface la vérité" },
      { clanCode: 'AKI', text: "Acceptable s'il sauve des vies" },
      { clanCode: 'EZK', text: "Intolérable s'il opprime" },
    ],
  },
  {
    id: 30,
    text: "Si tu gagnes, tu veux…",
    options: [
      { clanCode: 'ROY', text: "Un ordre stable" },
      { clanCode: 'ZOU', text: "Un village équilibré" },
      { clanCode: 'KER', text: "Des routes ouvertes" },
      { clanCode: 'AKA', text: "Un centre inviolable" },
      { clanCode: 'ASE', text: "Une histoire intacte" },
      { clanCode: 'AKI', text: "Un peuple plus fort et vivant" },
      { clanCode: 'EZK', text: "Une démocratie née de la révolte" },
    ],
  },
];

// Tiebreak questions (exact texts)
export const TIEBREAK_1: QuizQuestion = {
  id: 100,
  text: "Quel objectif te représente le plus ?",
  options: [
    { clanCode: 'ROY', text: "Préserver la stabilité via l'autorité" },
    { clanCode: 'ZOU', text: "Maintenir l'équilibre par les accords" },
    { clanCode: 'KER', text: "Garder la liberté de mouvement / routes" },
    { clanCode: 'AKA', text: "Garantir la sécurité par la défense" },
    { clanCode: 'ASE', text: "Protéger la mémoire et la vérité" },
    { clanCode: 'AKI', text: "Sauver des vies et renforcer les alliés" },
    { clanCode: 'EZK', text: "Renverser l'injustice pour instaurer la démocratie" },
  ],
};

export const TIEBREAK_2: QuizQuestion = {
  id: 101,
  text: "Ton style d'action préféré ?",
  options: [
    { clanCode: 'ROY', text: "Officiel" },
    { clanCode: 'ZOU', text: "Diplomatique" },
    { clanCode: 'KER', text: "Mobile" },
    { clanCode: 'AKA', text: "Protecteur" },
    { clanCode: 'ASE', text: "Rituel / connaissance" },
    { clanCode: 'AKI', text: "Soin / science" },
    { clanCode: 'EZK', text: "Subversion" },
  ],
};

// Clan images mapping
import maisonRoyale from '@/assets/clans/maison-royale.png';
import zoulous from '@/assets/clans/fraternite-zoulous.png';
import keryndes from '@/assets/clans/maison-keryndes.png';
import akande from '@/assets/clans/akande.png';
import aseyra from '@/assets/clans/cercle-aseyra.png';
import akila from '@/assets/clans/sources-akila.png';
import ezkar from '@/assets/clans/ezkar.png';

export const CLAN_IMAGES: Record<ClanCode, string> = {
  ROY: maisonRoyale,
  ZOU: zoulous,
  KER: keryndes,
  AKA: akande,
  ASE: aseyra,
  AKI: akila,
  EZK: ezkar,
};

// UI Colors for each clan
export const CLAN_UI_COLORS: Record<ClanCode, { 
  primary: string; 
  secondary: string;
  text: string;
  border: string;
  buttonBg: string;
  buttonText: string;
}> = {
  ROY: {
    primary: 'bg-amber-500',
    secondary: 'bg-amber-500/20',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    buttonBg: 'bg-amber-500 hover:bg-amber-600',
    buttonText: 'text-amber-950',
  },
  ZOU: {
    primary: 'bg-emerald-500',
    secondary: 'bg-emerald-500/20',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
    buttonBg: 'bg-emerald-500 hover:bg-emerald-600',
    buttonText: 'text-emerald-950',
  },
  KER: {
    primary: 'bg-sky-500',
    secondary: 'bg-sky-500/20',
    text: 'text-sky-500',
    border: 'border-sky-500/30',
    buttonBg: 'bg-sky-500 hover:bg-sky-600',
    buttonText: 'text-sky-950',
  },
  AKA: {
    primary: 'bg-red-500',
    secondary: 'bg-red-500/20',
    text: 'text-red-500',
    border: 'border-red-500/30',
    buttonBg: 'bg-red-500 hover:bg-red-600',
    buttonText: 'text-red-950',
  },
  ASE: {
    primary: 'bg-purple-500',
    secondary: 'bg-purple-500/20',
    text: 'text-purple-500',
    border: 'border-purple-500/30',
    buttonBg: 'bg-purple-500 hover:bg-purple-600',
    buttonText: 'text-purple-950',
  },
  AKI: {
    primary: 'bg-teal-500',
    secondary: 'bg-teal-500/20',
    text: 'text-teal-500',
    border: 'border-teal-500/30',
    buttonBg: 'bg-teal-500 hover:bg-teal-600',
    buttonText: 'text-teal-950',
  },
  EZK: {
    primary: 'bg-orange-500',
    secondary: 'bg-orange-500/20',
    text: 'text-orange-500',
    border: 'border-orange-500/30',
    buttonBg: 'bg-orange-500 hover:bg-orange-600',
    buttonText: 'text-orange-950',
  },
};

// Neutral theme for ties
export const NEUTRAL_COLORS = {
  primary: 'bg-slate-500',
  secondary: 'bg-slate-500/20',
  text: 'text-slate-400',
  border: 'border-slate-500/30',
  buttonBg: 'bg-slate-600 hover:bg-slate-700',
  buttonText: 'text-slate-50',
};
