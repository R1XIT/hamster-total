export interface ThreatDetection {
  threatName: string;
  resourcePath: string;
  detectionTime: string;
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
      resourcePath: String(item['Resources'] ?? ''),
      detectionTime: String(item['InitialDetectionTime'] ?? ''),
    }));
}

export function filterDetectionsByPath(detections: ThreatDetection[], targetPath: string): ThreatDetection[] {
  const normalized = targetPath.toLowerCase();
  return detections.filter((d) => d.resourcePath.toLowerCase().includes(normalized));
}
