export interface ThreatDetection {
  threatName: string;
  resourcePath: string;
  detectionTime: string;
}

/**
 * Turn Defender's `Resources` value into a real filesystem path. Live
 * Get-MpThreatDetection returns `Resources` as an ARRAY, and each entry is
 * prefixed with the resource type, e.g. "file:_C:\path\file". Both would break
 * the delete (shell.trashItem can't resolve "file:_C:\...") and clutter the
 * bubble, so take the first entry and strip the "<type>:_" prefix. A drive path
 * like "C:\" is never touched — the prefix pattern requires "letters + :_".
 */
function normalizeResourcePath(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  return String(first ?? '').replace(/^[a-z]+:_/i, '');
}

export function parseThreatDetections(json: string): ThreatDetection[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }

  const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      threatName: String(item['ThreatName'] ?? 'Unknown'),
      resourcePath: normalizeResourcePath(item['Resources']),
      detectionTime: String(item['InitialDetectionTime'] ?? ''),
    }));
}

export function filterDetectionsByPath(detections: ThreatDetection[], targetPath: string): ThreatDetection[] {
  const normalized = targetPath.toLowerCase();
  return detections.filter((d) => d.resourcePath.toLowerCase().includes(normalized));
}
