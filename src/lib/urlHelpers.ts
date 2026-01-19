/**
 * Get the public base URL for player links.
 * Uses the published URL to ensure anonymous players can access without Lovable auth.
 */
export function getPublicBaseUrl(): string {
  // Use the published app URL (always accessible without auth)
  return 'https://ndogmoabeng.com';
}

/**
 * Generate a player reconnection link with token.
 */
export function getPlayerReconnectUrl(gameId: string, token: string): string {
  return `${getPublicBaseUrl()}/player/${gameId}?token=${token}`;
}
