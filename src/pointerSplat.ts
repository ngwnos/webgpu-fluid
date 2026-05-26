import type { WhiteDyeFluidSplatOptions } from './fluid'

export type NormalizedPointerPoint = {
  readonly x: number
  readonly y: number
}

export function createPointerSplatOptions(
  point: NormalizedPointerPoint,
  previous: NormalizedPointerPoint | null,
  prime: boolean,
): WhiteDyeFluidSplatOptions {
  return {
    x: point.x,
    y: point.y,
    strength: prime || !previous ? 0.65 : 0.9,
    velocityX: previous ? previous.x - point.x : 0,
    velocityY: previous ? previous.y - point.y : 0,
    segmentScale: 0.45,
    radiusScale: prime ? 1.45 : 1,
    ...(previous ? { lastX: previous.x, lastY: previous.y } : {}),
  }
}
