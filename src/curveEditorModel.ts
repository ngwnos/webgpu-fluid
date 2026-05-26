export type CurvePoint = {
  readonly x: number
  readonly y: number
}

export type SolvedCurve = {
  readonly x: readonly number[]
  readonly y: readonly number[]
  readonly m: readonly number[]
}

export type MoveCurvePointOptions = {
  readonly minGap?: number
  readonly endpointXLocked?: boolean
  readonly snapDivisions?: number | null
}

export const DEFAULT_CURVE_POINTS: readonly CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
]

const DEFAULT_MIN_GAP = 1 / 255

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}

export function normalizeCurvePoints(points: readonly CurvePoint[]): CurvePoint[] {
  return points
    .map((point) => ({ x: clamp01(point.x), y: clamp01(point.y) }))
    .sort((a, b) => a.x - b.x)
}

export function solveNaturalCubicCurve(points: readonly CurvePoint[]): SolvedCurve {
  const normalizedPoints = normalizeCurvePoints(points)
  if (normalizedPoints.length < 2) {
    throw new Error('A curve needs at least two points.')
  }

  for (let index = 1; index < normalizedPoints.length; index += 1) {
    if (normalizedPoints[index].x <= normalizedPoints[index - 1].x) {
      throw new Error('Curve point x values must be strictly increasing.')
    }
  }

  const count = normalizedPoints.length
  const x = normalizedPoints.map((point) => point.x)
  const y = normalizedPoints.map((point) => point.y)
  const m = new Array<number>(count).fill(0)

  if (count === 2) {
    const slope = (y[1] - y[0]) / (x[1] - x[0])
    m[0] = slope
    m[1] = slope
    return { x, y, m }
  }

  let previousDx = x[1] - x[0]
  let previousSlope = (y[1] - y[0]) / previousDx
  m[0] = previousSlope

  for (let index = 2; index < count; index += 1) {
    const dx = x[index] - x[index - 1]
    const slope = (y[index] - y[index - 1]) / dx
    m[index - 1] = (previousSlope * dx + slope * previousDx) / (previousDx + dx)
    previousDx = dx
    previousSlope = slope
  }

  m[count - 1] = 2 * previousSlope - m[count - 2]
  m[0] = 2 * m[0] - m[1]

  const lower = new Array<number>(count).fill(0)
  const upper = new Array<number>(count).fill(0)
  const rhs = new Array<number>(count).fill(0)

  upper[0] = 0.5
  rhs[0] = 0.75 * (m[0] + m[1])

  for (let index = 1; index < count - 1; index += 1) {
    const denom = 2 * (x[index + 1] - x[index - 1])
    lower[index] = (x[index + 1] - x[index]) / denom
    upper[index] = (x[index] - x[index - 1]) / denom
    rhs[index] = 1.5 * m[index]
  }

  lower[count - 1] = 0.5
  rhs[count - 1] = 0.75 * (m[count - 2] + m[count - 1])

  for (let index = 1; index < count; index += 1) {
    const denom = 1 - upper[index - 1] * lower[index]
    if (index < count - 1) {
      upper[index] /= denom
    }
    rhs[index] = (rhs[index] - rhs[index - 1] * lower[index]) / denom
  }

  for (let index = count - 2; index >= 0; index -= 1) {
    rhs[index] -= upper[index] * rhs[index + 1]
  }

  for (let index = 0; index < count; index += 1) {
    m[index] = rhs[index]
  }

  return { x, y, m }
}

export function evaluateSolvedCurve(curve: SolvedCurve, input: number): number {
  const { x, y, m } = curve
  const count = x.length
  const value = clamp01(input)

  if (value <= x[0]) return y[0]
  if (value >= x[count - 1]) return y[count - 1]

  let lo = 0
  let hi = count - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (value < x[mid]) {
      hi = mid
    } else {
      lo = mid
    }
  }

  const x0 = x[lo]
  const x1 = x[hi]
  const y0 = y[lo]
  const y1 = y[hi]
  const m0 = m[lo]
  const m1 = m[hi]
  const width = x1 - x0
  const t = (value - x0) / width
  const u = 1 - t
  const output =
    (y0 * (1 + 2 * t) + m0 * width * t) * u * u +
    (y1 * (3 - 2 * t) - m1 * width * u) * t * t

  return clamp01(output)
}

export function createCurveLut(curve: SolvedCurve, size: number): Float32Array {
  const resolvedSize = Math.max(2, Math.round(size))
  const values = new Float32Array(resolvedSize)
  for (let index = 0; index < resolvedSize; index += 1) {
    values[index] = evaluateSolvedCurve(curve, index / (resolvedSize - 1))
  }
  return values
}

export function moveCurvePoint(
  points: readonly CurvePoint[],
  pointIndex: number,
  nextPoint: CurvePoint,
  options: MoveCurvePointOptions = {},
): CurvePoint[] {
  if (pointIndex < 0 || pointIndex >= points.length) return [...points]

  const minGap = options.minGap ?? DEFAULT_MIN_GAP
  const endpointXLocked = options.endpointXLocked ?? true
  const snapDivisions = options.snapDivisions ?? null
  const nextPoints = normalizeCurvePoints(points)
  const isFirst = pointIndex === 0
  const isLast = pointIndex === nextPoints.length - 1
  const previousX = isFirst ? 0 : nextPoints[pointIndex - 1].x + minGap
  const nextX = isLast ? 1 : nextPoints[pointIndex + 1].x - minGap
  const requestedX = endpointXLocked && (isFirst || isLast) ? nextPoints[pointIndex].x : nextPoint.x
  const moved = {
    x: clampToRange(snapValue(requestedX, snapDivisions), previousX, nextX),
    y: clamp01(snapValue(nextPoint.y, snapDivisions)),
  }

  nextPoints[pointIndex] = moved
  return nextPoints
}

export function addCurvePoint(
  points: readonly CurvePoint[],
  point: CurvePoint,
  maxPoints = 16,
  minGap = DEFAULT_MIN_GAP,
): CurvePoint[] {
  const nextPoints = normalizeCurvePoints(points)
  if (nextPoints.length >= maxPoints) return nextPoints

  const nextPoint = { x: clamp01(point.x), y: clamp01(point.y) }
  if (nextPoints.some((existing) => Math.abs(existing.x - nextPoint.x) < minGap)) {
    return nextPoints
  }

  return normalizeCurvePoints([...nextPoints, nextPoint])
}

export function deleteCurvePoint(points: readonly CurvePoint[], pointIndex: number, minPoints = 2): CurvePoint[] {
  const nextPoints = normalizeCurvePoints(points)
  const isEndpoint = pointIndex === 0 || pointIndex === nextPoints.length - 1
  if (isEndpoint || nextPoints.length <= minPoints) return nextPoints
  return nextPoints.filter((_, index) => index !== pointIndex)
}

function snapValue(value: number, divisions: number | null): number {
  if (!divisions || divisions <= 0) return value
  return Math.round(value * divisions) / divisions
}

function clampToRange(value: number, minValue: number, maxValue: number): number {
  return Math.min(Math.max(value, minValue), maxValue)
}
