/**
 * Pure key builders for Redis auth storage.
 * Key structure:
 *   auth:refresh:{userId}:{tokenId}  — stores the token string, TTL = 1 day
 *   auth:sessions:{userId}           — Set of active tokenIds for this user
 *
 * Why two keys per session?
 *   - tokenKey  → O(1) lookup/delete by userId + tokenId (rotation, logout)
 *   - sessionKey → O(1) wipe of ALL sessions (reuse attack, account compromise)
 */
export const getRefreshTokenKey = (userId: string, tokenId: string): string =>
  `auth:refresh:${userId}:${tokenId}`;

export const getUserSessionKey = (userId: string): string => `auth:sessions:${userId}`;
