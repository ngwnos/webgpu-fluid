import { describe, expect, test } from 'bun:test'

import { resolveCursorMovementGraphSample } from '../src/cursorMovementGraphModel'

describe('resolveCursorMovementGraphSample', () => {
  test('normalizes signed cursor deltas for graphing and clamps large movement', () => {
    expect(resolveCursorMovementGraphSample({ x: 12, y: -6 }, 24)).toEqual({
      x: 0.5,
      y: -0.25,
    })
    expect(resolveCursorMovementGraphSample({ x: 72, y: -72 }, 24)).toEqual({
      x: 1,
      y: -1,
    })
  })
})
