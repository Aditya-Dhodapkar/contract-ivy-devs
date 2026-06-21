// Minimal brute-force guard for the login route. Tracks FAILED attempts per
// client IP in a sliding window; after too many failures the IP is blocked for
// a cooldown. A successful login clears the record.
//
// Scope/limitation: this is in-memory, so the counter is per serverless
// instance and resets on cold starts. That's deliberate for "bare minimum" —
// it meaningfully slows password-guessing without extra infrastructure. If you
// later want strict, cross-instance limits, back this with Upstash/Redis or a
// Supabase table; the function signatures here won't need to change.

type Entry = { count: number; windowStart: number; blockedUntil?: number };

const store = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000; // count failures over 15 minutes
const MAX_FAILURES = 5; // allowed failures before a block
const BLOCK_MS = 15 * 60 * 1000; // cooldown once blocked

/** Call BEFORE checking credentials. If blocked, returns retryAfter seconds. */
export function checkRateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const e = store.get(key);
  if (e?.blockedUntil && e.blockedUntil > now) {
    return { ok: false, retryAfter: Math.ceil((e.blockedUntil - now) / 1000) };
  }
  return { ok: true };
}

/** Call on a FAILED login. Blocks the key once MAX_FAILURES is reached. */
export function recordFailure(key: string): void {
  const now = Date.now();
  let e = store.get(key);
  if (!e || now - e.windowStart > WINDOW_MS) {
    e = { count: 0, windowStart: now };
  }
  e.count++;
  if (e.count >= MAX_FAILURES) {
    e.blockedUntil = now + BLOCK_MS;
  }
  store.set(key, e);
  pruneOccasionally(now);
}

/** Call on a SUCCESSFUL login to clear the key's failure record. */
export function recordSuccess(key: string): void {
  store.delete(key);
}

// Keep the map from growing unbounded: drop entries whose window has expired
// and whose block has lifted. Cheap and only runs on writes.
let lastPrune = 0;
function pruneOccasionally(now: number): void {
  if (now - lastPrune < WINDOW_MS) return;
  lastPrune = now;
  for (const [k, e] of store) {
    const stale = now - e.windowStart > WINDOW_MS;
    const unblocked = !e.blockedUntil || e.blockedUntil <= now;
    if (stale && unblocked) store.delete(k);
  }
}
