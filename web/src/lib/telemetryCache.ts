interface CachedTelemetry {
  timestamp: number;
  data: any;
}

const telemetryCache = new Map<string, CachedTelemetry>();
export const TELEMETRY_CACHE_TTL_MS = 3500; // 3.5s cache to coalesce concurrent component polls

export function getCachedTelemetry(key: string): any | null {
  const cached = telemetryCache.get(key.toLowerCase());
  if (cached && Date.now() - cached.timestamp < TELEMETRY_CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

export function setCachedTelemetry(key: string, data: any) {
  telemetryCache.set(key.toLowerCase(), { timestamp: Date.now(), data });
}

export function invalidateTelemetryCache(humanOwner?: string) {
  if (humanOwner) {
    telemetryCache.delete(humanOwner.toLowerCase());
  } else {
    telemetryCache.clear();
  }
}
