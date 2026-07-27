export type HamsterState =
  | 'idle'
  | 'idleVariant1'
  | 'idleVariant2'
  | 'fallingAsleep'
  | 'sleeping'
  | 'waking'
  | 'dragging'
  | 'scanning'
  | 'eating';

export interface AnimationManifestEntry {
  file: string;
  durationMs: number;
  loop: boolean;
}

export type AnimationManifest = Record<HamsterState, AnimationManifestEntry>;
