// Number of bcrypt rounds — higher = slower hash = harder to brute force.
// 12 is the production standard: secure enough, fast enough (~300ms per hash).
// Never go below 10. Going above 14 starts affecting login performance.
export const BCRYPT_SALT_ROUNDS = 12;

// Redis TTL for refresh tokens in seconds — must match JWT refresh token expiry.
// If they drift, Redis may expire a token that JWT still considers valid (or vice versa).
export const REFRESH_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 1 day

export const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 day in ms

// Valid bcrypt hash (cost 12) used to normalize login response time when the email is not found.
// bcrypt.compare against this takes ~300ms for any input, matching the real credential-check path
// and preventing timing attacks that would otherwise reveal which emails are registered.
export const DUMMY_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW";
