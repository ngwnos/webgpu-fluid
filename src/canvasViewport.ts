export type CanvasCssSize = {
  readonly width: number
  readonly height: number
}

export type CanvasViewport = {
  readonly pixelRatio: number
  readonly width: number
  readonly height: number
}

export function resolveCanvasViewport(size: CanvasCssSize, pixelRatio: number): CanvasViewport {
  const resolvedPixelRatio = clampFinite(pixelRatio, 1, 4)

  return {
    pixelRatio: resolvedPixelRatio,
    width: Math.max(1, Math.round(clampFinite(size.width, 1, Number.MAX_SAFE_INTEGER) * resolvedPixelRatio)),
    height: Math.max(1, Math.round(clampFinite(size.height, 1, Number.MAX_SAFE_INTEGER) * resolvedPixelRatio)),
  }
}

function clampFinite(value: number, minValue: number, maxValue: number): number {
  if (!Number.isFinite(value)) return minValue
  return Math.min(Math.max(value, minValue), maxValue)
}
