'use client';

type CacheEnvelope<T> = {
  ts: number;
  data: T;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000;

export function readCustomerCache<T>(key: string, ttlMs: number = DEFAULT_TTL_MS): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.ts) return null;
    if (Date.now() - parsed.ts > ttlMs) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeCustomerCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    const payload: CacheEnvelope<T> = { ts: Date.now(), data };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearCustomerCache(key: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
