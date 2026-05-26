import { describe, expect, test } from 'bun:test'

import { createPointerSplatOptions } from '../src/pointerSplat'

describe('createPointerSplatOptions', () => {
  test('primes a new pointer trail with dye and no velocity', () => {
    expect(createPointerSplatOptions({ x: 0.25, y: 0.5 }, null, true)).toEqual({
      x: 0.25,
      y: 0.5,
      strength: 0.65,
      velocityX: 0,
      velocityY: 0,
      segmentScale: 0.45,
      radiusScale: 1.45,
    })
  })

  test('continues a pointer trail with velocity and previous position', () => {
    expect(createPointerSplatOptions({ x: 0.4, y: 0.25 }, { x: 0.1, y: 0.75 }, false, {
      movementStrength: 1,
    })).toEqual({
      x: 0.4,
      y: 0.25,
      strength: 0.9,
      velocityX: -0.30000000000000004,
      velocityY: 0.5,
      segmentScale: 0.45,
      radiusScale: 1,
      lastX: 0.1,
      lastY: 0.75,
    })
  })

  test('scales splat force from the smoothed cursor movement strength', () => {
    expect(createPointerSplatOptions({ x: 0.4, y: 0.25 }, { x: 0.1, y: 0.75 }, false, {
      movementStrength: 0,
    }).strength).toBe(0.08)
    expect(createPointerSplatOptions({ x: 0.4, y: 0.25 }, { x: 0.1, y: 0.75 }, false, {
      movementStrength: 0.5,
    }).strength).toBeCloseTo(0.49)
  })
})
