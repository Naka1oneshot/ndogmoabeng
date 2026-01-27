/**
 * Compute final positions for players based on their priority order and desired positions.
 * 
 * Algorithm (wrap-around):
 * - Process players in priority order (highest priority first)
 * - Each player gets their desired position if available
 * - If occupied, try next positions (+1, wrapping to 1 after max)
 * - Continue until a free position is found
 * 
 * @param priorityOrder - Array of player numbers in priority order (first = highest priority)
 * @param desiredPositions - Map of player number to their desired position
 * @param totalPlayers - Total number of players (positions will be 1 to totalPlayers)
 * @returns Map of player number to their final assigned position
 */
export function computeFinalPositions(
  priorityOrder: number[],
  desiredPositions: Record<number, number>,
  totalPlayers: number
): Record<number, number> {
  const result: Record<number, number> = {};
  const occupiedPositions = new Set<number>();
  
  for (const playerNum of priorityOrder) {
    const desiredPos = desiredPositions[playerNum] ?? 1;
    let finalPos = desiredPos;
    
    // Find first available position starting from desired, wrapping around
    let attempts = 0;
    while (occupiedPositions.has(finalPos) && attempts < totalPlayers) {
      finalPos = finalPos >= totalPlayers ? 1 : finalPos + 1;
      attempts++;
    }
    
    result[playerNum] = finalPos;
    occupiedPositions.add(finalPos);
  }
  
  return result;
}

/**
 * Get the attack order from final positions (position 1 attacks first, etc.)
 * @param finalPositions - Map of player number to final position
 * @returns Array of player numbers in attack order
 */
export function getAttackOrder(finalPositions: Record<number, number>): number[] {
  return Object.entries(finalPositions)
    .sort(([, posA], [, posB]) => posA - posB)
    .map(([playerNum]) => parseInt(playerNum));
}
