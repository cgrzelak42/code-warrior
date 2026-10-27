// Small versioned persistence layer over localStorage, with an in-memory fallback for
// private windows, SSR and tests. Everything the app saves goes through here.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

let fallback: KeyValueStore | null = null;

export function browserStore(): KeyValueStore {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const probe = "__bjiq_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    // Storage blocked; fall through to memory.
  }
  fallback ??= memoryStore();
  return fallback;
}

export const STORAGE_KEYS = {
  settings: "bjiq:settings:v1",
  stats: "bjiq:stats:v1",
  game: "bjiq:game:v1",
  missed: "bjiq:missed:v1",
  lastBet: "bjiq:lastBet",
  review: "bjiq:review:v1",
} as const;

export function loadJSON<T>(store: KeyValueStore, key: string, sanitize: (raw: unknown) => T, fallbackValue: T): T {
  try {
    const raw = store.getItem(key);
    if (raw == null) return fallbackValue;
    return sanitize(JSON.parse(raw));
  } catch {
    return fallbackValue;
  }
}

export function saveJSON(store: KeyValueStore, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
