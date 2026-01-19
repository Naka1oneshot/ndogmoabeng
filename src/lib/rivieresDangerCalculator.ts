/**
 * Système de génération automatique du danger pour RIVIERES
 * 
 * Paramètres de base:
 * - Mise moyenne attendue: 7 jetons par joueur
 * - Progression de difficulté sur les 3 manches
 * - Multiplicateur important pour le niveau 5
 */

interface DangerRange {
  min: number;
  max: number;
  suggested: number;
  isLevel5: boolean;
}

interface DangerCalculation {
  nbPlayersEnBateau: number;
  manche: number;
  niveau: number;
  basePerPlayer: number;
  mancheMultiplierMin: number;
  mancheMultiplierMax: number;
  level5Multiplier: number;
  range: DangerRange;
}

// Constantes de calcul
const BASE_TOKENS_PER_PLAYER = 7;
const LEVEL_5_MULTIPLIER = 1.8;

// Multiplicateurs par manche (progression de la pression)
const MANCHE_MULTIPLIERS: Record<number, { min: number; max: number }> = {
  1: { min: 0.7, max: 1.1 },   // Manche 1: Plus facile
  2: { min: 0.9, max: 1.4 },   // Manche 2: Modéré
  3: { min: 1.1, max: 1.7 },   // Manche 3: Difficile
};

/**
 * Calcule la plage de danger pour un niveau donné
 */
export function calculateDangerRange(
  nbPlayersEnBateau: number,
  manche: number,
  niveau: number
): DangerCalculation {
  // Valider les entrées
  if (nbPlayersEnBateau < 1) nbPlayersEnBateau = 1;
  if (manche < 1) manche = 1;
  if (manche > 3) manche = 3;
  if (niveau < 1) niveau = 1;
  if (niveau > 5) niveau = 5;

  const isLevel5 = niveau === 5;
  const mancheMultipliers = MANCHE_MULTIPLIERS[manche] || MANCHE_MULTIPLIERS[1];
  
  const basePerPlayer = BASE_TOKENS_PER_PLAYER;
  const level5Mult = isLevel5 ? LEVEL_5_MULTIPLIER : 1.0;

  // Calcul des bornes
  const rawMin = nbPlayersEnBateau * basePerPlayer * mancheMultipliers.min * level5Mult;
  const rawMax = nbPlayersEnBateau * basePerPlayer * mancheMultipliers.max * level5Mult;
  
  // Arrondir pour obtenir des valeurs propres
  const min = Math.round(rawMin);
  const max = Math.round(rawMax);
  
  // Valeur suggérée: moyenne des deux avec légère variance
  const suggested = Math.round((min + max) / 2);

  return {
    nbPlayersEnBateau,
    manche,
    niveau,
    basePerPlayer,
    mancheMultiplierMin: mancheMultipliers.min,
    mancheMultiplierMax: mancheMultipliers.max,
    level5Multiplier: level5Mult,
    range: {
      min,
      max,
      suggested,
      isLevel5,
    },
  };
}

/**
 * Génère une valeur de danger suggérée avec une variance aléatoire
 */
export function generateSuggestedDanger(
  nbPlayersEnBateau: number,
  manche: number,
  niveau: number
): number {
  const calc = calculateDangerRange(nbPlayersEnBateau, manche, niveau);
  const { min, max } = calc.range;
  
  // Ajouter une variance aléatoire dans la plage
  const variance = max - min;
  const randomOffset = Math.floor(Math.random() * variance);
  
  return min + randomOffset;
}

/**
 * Formatte l'affichage de la plage de danger pour les joueurs
 */
export function formatDangerRangeDisplay(range: DangerRange): string {
  return `${range.min} - ${range.max}`;
}

/**
 * Génère le texte explicatif du calcul pour le MJ
 */
export function getDangerCalculationExplanation(calc: DangerCalculation): string[] {
  const lines: string[] = [];
  
  lines.push(`Joueurs en bateau: ${calc.nbPlayersEnBateau}`);
  lines.push(`Manche ${calc.manche}/3 • Niveau ${calc.niveau}/5`);
  lines.push('');
  lines.push('Formule:');
  lines.push(`Base = ${calc.nbPlayersEnBateau} joueurs × ${calc.basePerPlayer} jetons/joueur = ${calc.nbPlayersEnBateau * calc.basePerPlayer}`);
  lines.push(`Multiplicateur manche ${calc.manche}: ${calc.mancheMultiplierMin}x - ${calc.mancheMultiplierMax}x`);
  
  if (calc.range.isLevel5) {
    lines.push(`Multiplicateur niveau 5: ×${calc.level5Multiplier}`);
  }
  
  lines.push('');
  lines.push(`Plage résultante: ${calc.range.min} - ${calc.range.max}`);
  lines.push(`Suggestion: ${calc.range.suggested}`);
  
  return lines;
}

/**
 * Obtient les statistiques de difficulté pour affichage
 */
export function getDifficultyLabel(manche: number, niveau: number): { label: string; color: string } {
  const isLevel5 = niveau === 5;
  
  if (manche === 1 && !isLevel5) {
    return { label: 'Facile', color: 'text-green-400' };
  } else if (manche === 1 && isLevel5) {
    return { label: 'Modéré', color: 'text-amber-400' };
  } else if (manche === 2 && !isLevel5) {
    return { label: 'Modéré', color: 'text-amber-400' };
  } else if (manche === 2 && isLevel5) {
    return { label: 'Difficile', color: 'text-orange-400' };
  } else if (manche === 3 && !isLevel5) {
    return { label: 'Difficile', color: 'text-orange-400' };
  } else {
    return { label: 'Extrême', color: 'text-red-400' };
  }
}
