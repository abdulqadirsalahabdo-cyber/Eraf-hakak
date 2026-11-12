import type { ConsultationMeta } from '../src/types/legal.ts';

interface CachedResponse {
  key: string;
  text: string;
  suggestions: string[];
  meta: ConsultationMeta;
  createdAt: number;
}

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_CACHE_ENTRIES = 120;
const queryCache = new Map<string, CachedResponse>();

function normalizeCacheKey(query: string): string {
  return query
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FF0-9a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getCachedConsultation(query: string, hasHistory: boolean, hasAttachment: boolean): CachedResponse | null {
  if (hasHistory || hasAttachment) return null;
  const key = normalizeCacheKey(query);
  if (key.length < 10) return null;
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedConsultation(
  query: string,
  text: string,
  suggestions: string[],
  meta: ConsultationMeta
): void {
  const key = normalizeCacheKey(query);
  if (key.length < 10 || text.length < 80) return;
  if (queryCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }
  queryCache.set(key, {
    key,
    text,
    suggestions,
    meta: { ...meta, fromCache: true },
    createdAt: Date.now()
  });
}

// Concurrency-aware smart queue for burst protection
const MAX_CONCURRENT_STREAMS = 12;
let activeStreams = 0;
const waitingResolvers: Array<() => void> = [];

export async function acquireConsultationSlot(): Promise<{ queuePosition: number; release: () => void }> {
  if (activeStreams < MAX_CONCURRENT_STREAMS) {
    activeStreams++;
    let released = false;
    return {
      queuePosition: 0,
      release: () => {
        if (released) return;
        released = true;
        activeStreams = Math.max(0, activeStreams - 1);
        const next = waitingResolvers.shift();
        if (next) next();
      }
    };
  }

  const queuePosition = waitingResolvers.length + 1;
  await new Promise<void>((resolve) => {
    waitingResolvers.push(resolve);
  });
  activeStreams++;
  let released = false;
  return {
    queuePosition,
    release: () => {
      if (released) return;
      released = true;
      activeStreams = Math.max(0, activeStreams - 1);
      const next = waitingResolvers.shift();
      if (next) next();
    }
  };
}
