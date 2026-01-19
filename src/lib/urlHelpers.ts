/**
 * Get the public base URL for player links.
 * Uses the published URL if available, otherwise falls back to the preview URL.
 * This avoids using lovableproject.com which requires Lovable authentication.
 */
export function getPublicBaseUrl(): string {
  // Published URL has priority
  if (import.meta.env.VITE_PUBLISHED_URL) {
    return import.meta.env.VITE_PUBLISHED_URL;
  }
  
  // Fallback to preview URL using project ID
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (projectId) {
    return `https://id-preview--${projectId}.lovable.app`;
  }
  
  // Last resort: use current origin (may not work in internal preview)
  return window.location.origin;
}

/**
 * Generate a player reconnection link with token.
 */
export function getPlayerReconnectUrl(gameId: string, token: string): string {
  return `${getPublicBaseUrl()}/player/${gameId}?token=${token}`;
}
