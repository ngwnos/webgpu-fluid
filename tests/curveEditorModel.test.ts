import { describe, expect, test } from 'bun:test'

import {
  addCurvePoint,
  createCurveLut,
  deleteCurvePoint,
  evaluateSolvedCurve,
  moveCurvePoint,
  solveNaturalCubicCurve,
} from '../src/curveEditorModel'

describe('curve editor model', () => {
  test('evaluates a linear two-point curve as a stable identity mapping', () => {
    const curve = solveNaturalCubicCurve([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])

    expect(evaluateSolvedCurve(curve, 0.25)).toBeCloseTo(0.25, 6)
    expect(evaluateSolvedCurve(curve, 0.5)).toBeCloseTo(0.5, 6)
    expect(evaluateSolvedCurve(curve, 0.75)).toBeCloseTo(0.75, 6)
  })

  test('passes through user points and clamps outside the curve range', () => {
    const curve = solveNaturalCubicCurve([
      { x: 0, y: 0.1 },
      { x: 0.5, y: 0.75 },
      { x: 1, y: 0.9 },
    ])

    expect(evaluateSolvedCurve(curve, -1)).toBeCloseTo(0.1, 6)
    expect(evaluateSolvedCurve(curve, 0.5)).toBeCloseTo(0.75, 6)
    expect(evaluateSolvedCurve(curve, 2)).toBeCloseTo(0.9, 6)
  })

  test('creates a reusable LUT from the solved curve', () => {
    const curve = solveNaturalCubicCurve([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ])

    expect(Array.from(createCurveLut(curve, 5))).toEqual([0, 0.25, 0.5, 0.75, 1])
  })

  test('keeps dragged points ordered and endpoint x positions locked', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ]

    const movedEndpoint = moveCurvePoint(points, 0, { x: 0.4, y: 0.2 })
    const movedMiddle = moveCurvePoint(points, 1, { x: 1, y: 0.8 }, { minGap: 0.1 })

    expect(movedEndpoint[0]).toEqual({ x: 0, y: 0.2 })
    expect(movedMiddle[1]).toEqual({ x: 0.9, y: 0.8 })
  })

  test('adds sorted interior points and only deletes non-endpoints', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]

    const added = addCurvePoint(points, { x: 0.35, y: 0.7 })
    const endpointDelete = deleteCurvePoint(added, 0)
    const interiorDelete = deleteCurvePoint(added, 1)

    expect(added).toEqual([
      { x: 0, y: 0 },
      { x: 0.35, y: 0.7 },
      { x: 1, y: 1 },
    ])
    expect(endpointDelete).toEqual(added)
    expect(interiorDelete).toEqual(points)
  })
})
