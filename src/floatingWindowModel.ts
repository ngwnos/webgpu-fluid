export type Point = {
  readonly x: number
  readonly y: number
}

export type Size = {
  readonly width: number
  readonly height: number
}

export type DraggedWindowPositionOptions = {
  readonly originPointer: Point
  readonly originPosition: Point
  readonly pointer: Point
  readonly viewport: Size
  readonly windowSize: Size
}

export function resolveDraggedWindowPosition(options: DraggedWindowPositionOptions): Point {
  const nextX = options.originPosition.x + options.pointer.x - options.originPointer.x
  const nextY = options.originPosition.y + options.pointer.y - options.originPointer.y
  const maxX = Math.max(0, options.viewport.width - options.windowSize.width)
  const maxY = Math.max(0, options.viewport.height - 32)

  return {
    x: clampFinite(nextX, 0, maxX),
    y: clampFinite(nextY, 0, maxY),
  }
}

function clampFinite(value: number, minValue: number, maxValue: number): number {
  if (!Number.isFinite(value)) return minValue
  return Math.min(Math.max(value, minValue), maxValue)
}
