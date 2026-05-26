import { describe, expect, test } from 'bun:test'

import { resolveCanvasViewport } from '../src/canvasViewport'

describe('resolveCanvasViewport', () => {
  test('uses the canvas css box and pixel ratio for the WebGPU backbuffer', () => {
    expect(resolveCanvasViewport({ width: 800, height: 552 }, 2)).toEqual({
      pixelRatio: 2,
      width: 1600,
      height: 1104,
    })
  })

  test('clamps invalid canvas dimensions to a drawable area', () => {
    expect(resolveCanvasViewport({ width: 0, height: Number.NaN }, 1.5)).toEqual({
      pixelRatio: 1.5,
      width: 2,
      height: 2,
    })
  })
})
