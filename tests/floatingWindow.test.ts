import { describe, expect, test } from 'bun:test'

import { resolveDraggedWindowPosition } from '../src/floatingWindowModel'

describe('resolveDraggedWindowPosition', () => {
  test('moves by pointer delta from the drag origin', () => {
    expect(
      resolveDraggedWindowPosition({
        originPointer: { x: 100, y: 80 },
        originPosition: { x: 24, y: 32 },
        pointer: { x: 150, y: 130 },
        viewport: { width: 800, height: 600 },
        windowSize: { width: 260, height: 180 },
      }),
    ).toEqual({ x: 74, y: 82 })
  })

  test('keeps the title bar reachable inside the viewport', () => {
    expect(
      resolveDraggedWindowPosition({
        originPointer: { x: 100, y: 100 },
        originPosition: { x: 24, y: 32 },
        pointer: { x: 900, y: -200 },
        viewport: { width: 800, height: 600 },
        windowSize: { width: 260, height: 180 },
      }),
    ).toEqual({ x: 540, y: 0 })
  })
})
