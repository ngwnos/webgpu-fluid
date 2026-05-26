import { useMemo, useRef, useState } from 'react'

import {
  DEFAULT_CURVE_POINTS,
  addCurvePoint,
  clamp01,
  deleteCurvePoint,
  evaluateSolvedCurve,
  moveCurvePoint,
  normalizeCurvePoints,
  solveNaturalCubicCurve,
  type CurvePoint,
} from './curveEditorModel'

export type CurveEditorProps = {
  readonly points?: readonly CurvePoint[]
  readonly defaultPoints?: readonly CurvePoint[]
  readonly onChange?: (points: CurvePoint[]) => void
  readonly width?: number
  readonly height?: number
  readonly minPoints?: number
  readonly maxPoints?: number
  readonly snap?: boolean
  readonly snapDivisions?: number
  readonly className?: string
}

type PlotMetrics = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const DEFAULT_WIDTH = 408
const DEFAULT_HEIGHT = 292
const PLOT_INSET_X = 16
const PLOT_INSET_Y = 12
const DEFAULT_MAX_POINTS = 16
const GRID_STEPS = [0, 0.25, 0.5, 0.75, 1] as const

export function CurveEditor({
  points,
  defaultPoints = DEFAULT_CURVE_POINTS,
  onChange,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  minPoints = 2,
  maxPoints = DEFAULT_MAX_POINTS,
  snap = false,
  snapDivisions = 16,
  className,
}: CurveEditorProps): React.JSX.Element {
  const [internalPoints, setInternalPoints] = useState<CurvePoint[]>(() => normalizeCurvePoints(defaultPoints))
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const editorPoints = normalizeCurvePoints(points ?? internalPoints)
  const resolvedSelectedIndex =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < editorPoints.length ? selectedIndex : null
  const selectedPoint = resolvedSelectedIndex === null ? null : editorPoints[resolvedSelectedIndex]
  const selectedPointIsEndpoint =
    resolvedSelectedIndex === 0 || resolvedSelectedIndex === editorPoints.length - 1
  const plot = useMemo<PlotMetrics>(
    () => ({
      x: PLOT_INSET_X,
      y: PLOT_INSET_Y,
      width: Math.max(1, width - PLOT_INSET_X * 2),
      height: Math.max(1, height - PLOT_INSET_Y * 2),
    }),
    [height, width],
  )
  const solvedCurve = useMemo(() => solveNaturalCubicCurve(editorPoints), [editorPoints])
  const curvePath = useMemo(() => createSampledCurvePath(solvedCurve, plot), [plot, solvedCurve])
  const diagonalPath = `M ${plot.x} ${plot.y + plot.height} L ${plot.x + plot.width} ${plot.y}`
  const classes = ['curve-editor', className].filter(Boolean).join(' ')

  const updatePoints = (nextPoints: CurvePoint[]) => {
    const normalized = normalizeCurvePoints(nextPoints)
    if (!points) {
      setInternalPoints(normalized)
    }
    onChange?.(normalized)
  }

  const updateSelectedPoint = (nextPoint: CurvePoint) => {
    if (resolvedSelectedIndex === null) return

    updatePoints(
      moveCurvePoint(editorPoints, resolvedSelectedIndex, nextPoint, {
        endpointXLocked: true,
        snapDivisions: snap ? snapDivisions : null,
      }),
    )
  }

  const beginPointDrag = (event: React.PointerEvent<SVGCircleElement>, pointIndex: number) => {
    if (event.button !== 0) return

    event.stopPropagation()
    svgRef.current?.setPointerCapture(event.pointerId)
    dragPointerId.current = event.pointerId
    setSelectedIndex(pointIndex)
    setDraggingIndex(pointIndex)
  }

  const beginPlotDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return

    const nextPoint = svgPointerToCurvePoint(event, plot)
    const nextPoints = addCurvePoint(editorPoints, nextPoint, maxPoints)
    const nextIndex = findNearestPointIndex(nextPoints, nextPoint)
    updatePoints(nextPoints)
    setSelectedIndex(nextIndex)
    setDraggingIndex(nextIndex)
    svgRef.current?.setPointerCapture(event.pointerId)
    dragPointerId.current = event.pointerId
  }

  const continueDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIndex === null || dragPointerId.current !== event.pointerId) return

    updatePoints(
      moveCurvePoint(editorPoints, draggingIndex, svgPointerToCurvePoint(event, plot), {
        endpointXLocked: true,
        snapDivisions: snap ? snapDivisions : null,
      }),
    )
  }

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragPointerId.current === event.pointerId) {
      dragPointerId.current = null
      setDraggingIndex(null)
    }
  }

  const deleteSelectedPoint = () => {
    if (resolvedSelectedIndex === null) return

    const nextPoints = deleteCurvePoint(editorPoints, resolvedSelectedIndex, minPoints)
    updatePoints(nextPoints)
    setSelectedIndex(null)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('input')) return
    if (event.key !== 'Delete' && event.key !== 'Backspace') return

    event.preventDefault()
    deleteSelectedPoint()
  }

  return (
    <div className={classes} onKeyDown={handleKeyDown} tabIndex={0}>
      <svg
        ref={svgRef}
        className="curve-editor__plot"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Curve editor"
        onPointerDown={beginPlotDrag}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <rect className="curve-editor__plot-background" x={plot.x} y={plot.y} width={plot.width} height={plot.height} />
        {GRID_STEPS.map((step) => (
          <g key={step}>
            <line
              className="curve-editor__grid-line"
              x1={plot.x + step * plot.width}
              y1={plot.y}
              x2={plot.x + step * plot.width}
              y2={plot.y + plot.height}
            />
            <line
              className="curve-editor__grid-line"
              x1={plot.x}
              y1={plot.y + step * plot.height}
              x2={plot.x + plot.width}
              y2={plot.y + step * plot.height}
            />
          </g>
        ))}
        <path className="curve-editor__diagonal" d={diagonalPath} />
        <path className="curve-editor__curve" d={curvePath} />
        {editorPoints.map((point, index) => {
          const position = curvePointToSvgPoint(point, plot)
          return (
            <g className="curve-editor__point-group" key={`${index}:${point.x}:${point.y}`}>
              <circle
                className="curve-editor__point-hit"
                cx={position.x}
                cy={position.y}
                r="12"
                onPointerDown={(event) => beginPointDrag(event, index)}
              />
              <circle
                className="curve-editor__point"
                data-selected={resolvedSelectedIndex === index}
                cx={position.x}
                cy={position.y}
                r="4.8"
              />
            </g>
          )
        })}
      </svg>

      <div className="curve-editor__controls">
        <label className="curve-editor__field">
          <span>In</span>
          <input
            type="number"
            min="0"
            max="255"
            value={selectedPoint ? Math.round(selectedPoint.x * 255) : ''}
            disabled={!selectedPoint || selectedPointIsEndpoint}
            onChange={(event) =>
              selectedPoint && updateSelectedPoint({ ...selectedPoint, x: Number(event.currentTarget.value) / 255 })
            }
          />
        </label>
        <label className="curve-editor__field">
          <span>Out</span>
          <input
            type="number"
            min="0"
            max="255"
            value={selectedPoint ? Math.round(selectedPoint.y * 255) : ''}
            disabled={!selectedPoint}
            onChange={(event) =>
              selectedPoint && updateSelectedPoint({ ...selectedPoint, y: Number(event.currentTarget.value) / 255 })
            }
          />
        </label>
        <button
          className="curve-editor__button"
          type="button"
          disabled={resolvedSelectedIndex === null || resolvedSelectedIndex === 0 || resolvedSelectedIndex === editorPoints.length - 1}
          onClick={deleteSelectedPoint}
        >
          Delete
        </button>
        <button
          className="curve-editor__button"
          type="button"
          onClick={() => {
            updatePoints([...DEFAULT_CURVE_POINTS])
            setSelectedIndex(null)
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

function createSampledCurvePath(curve: ReturnType<typeof solveNaturalCubicCurve>, plot: PlotMetrics): string {
  const sampleCount = Math.max(64, Math.round(plot.width))
  const points: string[] = []
  for (let index = 0; index < sampleCount; index += 1) {
    const input = index / (sampleCount - 1)
    const output = evaluateSolvedCurve(curve, input)
    const position = curvePointToSvgPoint({ x: input, y: output }, plot)
    points.push(`${index === 0 ? 'M' : 'L'} ${position.x.toFixed(2)} ${position.y.toFixed(2)}`)
  }
  return points.join(' ')
}

function curvePointToSvgPoint(point: CurvePoint, plot: PlotMetrics): CurvePoint {
  return {
    x: plot.x + clamp01(point.x) * plot.width,
    y: plot.y + (1 - clamp01(point.y)) * plot.height,
  }
}

function svgPointerToCurvePoint(event: React.PointerEvent<SVGSVGElement>, plot: PlotMetrics): CurvePoint {
  const rect = event.currentTarget.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * Number(event.currentTarget.viewBox.baseVal.width)
  const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * Number(event.currentTarget.viewBox.baseVal.height)

  return {
    x: clamp01((x - plot.x) / plot.width),
    y: clamp01(1 - (y - plot.y) / plot.height),
  }
}

function findNearestPointIndex(points: readonly CurvePoint[], point: CurvePoint): number {
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length; index += 1) {
    const dx = points[index].x - point.x
    const dy = points[index].y - point.y
    const distance = dx * dx + dy * dy
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  }
  return nearestIndex
}
