// Seeded random number generator for deterministic quiz behavior

/**
 * FNV-1a hash function to convert string to uint32
 */
export function hashStringToUint32(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Mulberry32 PRNG - fast, deterministic, good distribution
 * Returns a function that generates random numbers in [0, 1)
 */
export function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Creates a seeded random function from a string seed
 */
export function createSeededRandom(seedString: string): () => number {
  const seedNumber = hashStringToUint32(seedString);
  return mulberry32(seedNumber);
}

/**
 * Fisher-Yates shuffle using a seeded random function
 * Returns a NEW array (does not mutate original)
 */
export function seededShuffle<T>(array: T[], randFn: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randFn() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Select first n items from a seeded shuffle
 */
export function seededPick<T>(array: T[], count: number, randFn: () => number): T[] {
  const shuffled = seededShuffle(array, randFn);
  return shuffled.slice(0, count);
}

/**
 * Generate a stable seed for a user's quiz
 */
export function generateQuizSeed(userId: string): string {
  return `${userId}:CLAN_QUIZ_V1`;
}
