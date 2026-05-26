import { describe, expect, test } from 'bun:test'

import {
  advanceCursorMovementEnvelope,
  resolveCursorMovementGraphSample,
} from '../src/cursorMovementGraphModel'

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

describe('advanceCursorMovementEnvelope', () => {
  test('attacks toward cursor speed and releases toward zero without going negative', () => {
    const rising = advanceCursorMovementEnvelope(0, { x: 24, y: 0 }, 80, {
      attackMs: 80,
      releaseMs: 240,
      maxDelta: 24,
    })
    const falling = advanceCursorMovementEnvelope(rising, { x: 0, y: 0 }, 80, {
      attackMs: 80,
      releaseMs: 240,
      maxDelta: 24,
    })
    const stopped = advanceCursorMovementEnvelope(0.02, { x: 0, y: 0 }, 5000, {
      attackMs: 80,
      releaseMs: 240,
      maxDelta: 24,
    })

    expect(rising).toBeGreaterThan(0)
    expect(rising).toBeLessThan(1)
    expect(falling).toBeGreaterThan(0)
    expect(falling).toBeLessThan(rising)
    expect(stopped).toBeGreaterThanOrEqual(0)
  })
})
