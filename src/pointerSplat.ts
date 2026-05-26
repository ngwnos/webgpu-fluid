import type { WhiteDyeFluidSplatOptions } from './fluid'

export type NormalizedPointerPoint = {
  readonly x: number
  readonly y: number
}

export type PointerSplatMotionOptions = {
  readonly movementStrength?: number
}

const MIN_POINTER_SPLAT_STRENGTH = 0.08
const MIN_PRIME_POINTER_SPLAT_STRENGTH = 0.18
const MAX_POINTER_SPLAT_STRENGTH = 0.9
const MAX_PRIME_POINTER_SPLAT_STRENGTH = 0.65

export function createPointerSplatOptions(
  point: NormalizedPointerPoint,
  previous: NormalizedPointerPoint | null,
  prime: boolean,
  options: PointerSplatMotionOptions = {},
): WhiteDyeFluidSplatOptions {
  const movementStrength = clamp01(options.movementStrength ?? 1)
  const minStrength = prime || !previous ? MIN_PRIME_POINTER_SPLAT_STRENGTH : MIN_POINTER_SPLAT_STRENGTH
  const maxStrength = prime || !previous ? MAX_PRIME_POINTER_SPLAT_STRENGTH : MAX_POINTER_SPLAT_STRENGTH

  return {
    x: point.x,
    y: point.y,
    strength: minStrength + (maxStrength - minStrength) * movementStrength,
    velocityX: previous ? previous.x - point.x : 0,
    velocityY: previous ? previous.y - point.y : 0,
    segmentScale: 0.45,
    radiusScale: prime ? 1.45 : 1,
    ...(previous ? { lastX: previous.x, lastY: previous.y } : {}),
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}
