import type { ConsultationMeta } from '../src/types/legal.ts';

interface CachedResponse {
  key: string;
  text: string;
  suggestions: string[];
  meta: ConsultationMeta;
  createdAt: number;
}

const CACHE_TTL_MS = 1000 * 60 * 60; // 60 minutes for high-traffic burst caching
const MAX_CACHE_ENTRIES = 1000;
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

export function getCachedConsultation(
  query: string,
  hasHistory: boolean,
  hasAttachment: boolean
): CachedResponse | null {
  if (hasHistory || hasAttachment) return null;
  const key = normalizeCacheKey(query);
  if (key.length < 10) return null;
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  // Refresh LRU order
  queryCache.delete(key);
  queryCache.set(key, entry);
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
    createdAt: Date.now(),
  });
}

// High-scale burst queue with bounded wait & instant graceful load-shedding
const MAX_CONCURRENT_STREAMS = 64;
const MAX_QUEUE_LENGTH = 250;
const MAX_WAIT_MS = 3500;

let activeStreams = 0;
const waitingResolvers: Array<() => void> = [];

export async function acquireConsultationSlot(): Promise<{
  queuePosition: number;
  shedLoad: boolean;
  release: () => void;
}> {
  if (activeStreams < MAX_CONCURRENT_STREAMS) {
    activeStreams++;
    let released = false;
    return {
      queuePosition: 0,
      shedLoad: false,
      release: () => {
        if (released) return;
        released = true;
        activeStreams = Math.max(0, activeStreams - 1);
        const next = waitingResolvers.shift();
        if (next) next();
      },
    };
  }

  // If surge traffic exceeds queue bounds, shed immediately to fast grounded legal solver
  if (waitingResolvers.length >= MAX_QUEUE_LENGTH) {
    return {
      queuePosition: waitingResolvers.length,
      shedLoad: true,
      release: () => {},
    };
  }

  const queuePosition = waitingResolvers.length + 1;
  let resolvedByQueue = false;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      const idx = waitingResolvers.indexOf(onReady);
      if (idx >= 0) waitingResolvers.splice(idx, 1);
      resolve();
    }, MAX_WAIT_MS);

    const onReady = () => {
      clearTimeout(timer);
      resolvedByQueue = true;
      resolve();
    };

    waitingResolvers.push(onReady);
  });

  if (!resolvedByQueue) {
    return {
      queuePosition,
      shedLoad: true,
      release: () => {},
    };
  }

  activeStreams++;
  let released = false;
  return {
    queuePosition,
    shedLoad: false,
    release: () => {
      if (released) return;
      released = true;
      activeStreams = Math.max(0, activeStreams - 1);
      const next = waitingResolvers.shift();
      if (next) next();
    },
  };
}
