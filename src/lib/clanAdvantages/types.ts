// Central types for clan advantages system

export type GameCode = 'FORET' | 'RIVIERES' | 'SHERIFF' | 'INFECTION' | 'LION' | string;

export type ClanId = 
  | 'maison-royale' 
  | 'fraternite-zoulous' 
  | 'maison-keryndes' 
  | 'akande' 
  | 'cercle-aseyra' 
  | 'sources-akila' 
  | 'ezkar';

export interface ClanAdvantage {
  title: string;
  description: string;
  source: string; // File or constant where this is implemented
}

export interface ClanAdvantagesConfig {
  gameCode: GameCode;
  gameName: string;
  advantages: Record<ClanId, ClanAdvantage[]>;
}
