export type CursorMovementDelta = {
  readonly x: number
  readonly y: number
}

export type CursorMovementSample = {
  readonly x: number
  readonly y: number
}

export type CursorMovementEnvelopeOptions = {
  readonly attackMs?: number
  readonly releaseMs?: number
  readonly maxDelta?: number
}

export const CURSOR_MOVEMENT_GRAPH_WIDTH = 128
export const CURSOR_MOVEMENT_GRAPH_HEIGHT = 26
export const CURSOR_MOVEMENT_GRAPH_MAX_DELTA = 24
export const CURSOR_MOVEMENT_ATTACK_MS = 80
export const CURSOR_MOVEMENT_RELEASE_MS = 260

export function resolveCursorMovementGraphSample(
  delta: CursorMovementDelta,
  maxDelta = CURSOR_MOVEMENT_GRAPH_MAX_DELTA,
): CursorMovementSample {
  const scale = Math.max(1, Math.abs(maxDelta))

  return {
    x: clampSigned(delta.x / scale),
    y: clampSigned(delta.y / scale),
  }
}

export function advanceCursorMovementEnvelope(
  currentValue: number,
  delta: CursorMovementDelta,
  elapsedMs: number,
  options: CursorMovementEnvelopeOptions = {},
): number {
  const maxDelta = options.maxDelta ?? CURSOR_MOVEMENT_GRAPH_MAX_DELTA
  const attackMs = Math.max(1, options.attackMs ?? CURSOR_MOVEMENT_ATTACK_MS)
  const releaseMs = Math.max(1, options.releaseMs ?? CURSOR_MOVEMENT_RELEASE_MS)
  const target = clamp01(Math.hypot(delta.x, delta.y) / Math.max(1, Math.abs(maxDelta)))
  const timeConstant = target > currentValue ? attackMs : releaseMs
  const coefficient = 1 - Math.exp(-Math.max(0, elapsedMs) / timeConstant)

  return clamp01(currentValue + (target - currentValue) * coefficient)
}

function clampSigned(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, -1), 1)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}
