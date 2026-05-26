export type CursorMovementDelta = {
  readonly x: number
  readonly y: number
}

export type CursorMovementSample = {
  readonly x: number
  readonly y: number
}

export const CURSOR_MOVEMENT_GRAPH_WIDTH = 128
export const CURSOR_MOVEMENT_GRAPH_HEIGHT = 26
export const CURSOR_MOVEMENT_GRAPH_MAX_DELTA = 24

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

function clampSigned(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, -1), 1)
}
