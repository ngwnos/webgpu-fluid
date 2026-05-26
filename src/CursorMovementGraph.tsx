import { useEffect, useRef } from 'react'

import {
  CURSOR_MOVEMENT_GRAPH_HEIGHT,
  CURSOR_MOVEMENT_GRAPH_WIDTH,
  advanceCursorMovementEnvelope,
  resolveCursorMovementGraphSample,
  type CursorMovementDelta,
} from './cursorMovementGraphModel'

const CSS_WIDTH = CURSOR_MOVEMENT_GRAPH_WIDTH
const CSS_HEIGHT = CURSOR_MOVEMENT_GRAPH_HEIGHT
const GRAPH_SAMPLE_INTERVAL_MS = 1000 / 30

export function CursorMovementGraph(): React.JSX.Element {
  const movementCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const speedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pendingDelta = useRef<CursorMovementDelta>({ x: 0, y: 0 })
  const lastPointer = useRef<{ readonly x: number; readonly y: number } | null>(null)
  const movementEnvelope = useRef(0)

  useEffect(() => {
    let animationFrame = 0
    let movementContext: CanvasRenderingContext2D | null = null
    let speedContext: CanvasRenderingContext2D | null = null
    let pixelRatio = 1
    let lastSampleTime = performance.now()

    const movementCanvas = movementCanvasRef.current
    const speedCanvas = speedCanvasRef.current
    if (!movementCanvas || !speedCanvas) return undefined

    const resizeCanvas = () => {
      const nextPixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      const width = Math.round(CSS_WIDTH * nextPixelRatio)
      const height = Math.round(CSS_HEIGHT * nextPixelRatio)

      for (const canvas of [movementCanvas, speedCanvas]) {
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
      }

      pixelRatio = nextPixelRatio
      movementContext = movementCanvas.getContext('2d')
      speedContext = speedCanvas.getContext('2d')
      if (movementContext) clearGraph(movementContext, movementCanvas)
      if (speedContext) clearGraph(speedContext, speedCanvas)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const fallbackDelta = lastPointer.current
        ? { x: event.clientX - lastPointer.current.x, y: event.clientY - lastPointer.current.y }
        : { x: 0, y: 0 }
      const movementX = Number.isFinite(event.movementX) && event.movementX !== 0 ? event.movementX : fallbackDelta.x
      const movementY = Number.isFinite(event.movementY) && event.movementY !== 0 ? event.movementY : fallbackDelta.y

      pendingDelta.current = {
        x: pendingDelta.current.x + movementX,
        y: pendingDelta.current.y + movementY,
      }
      lastPointer.current = { x: event.clientX, y: event.clientY }
    }

    const handlePointerLeave = () => {
      lastPointer.current = null
    }

    const renderFrame = (time: DOMHighResTimeStamp) => {
      const elapsedMs = time - lastSampleTime
      if (movementContext && speedContext && elapsedMs >= GRAPH_SAMPLE_INTERVAL_MS) {
        const delta = pendingDelta.current
        movementEnvelope.current = advanceCursorMovementEnvelope(movementEnvelope.current, delta, elapsedMs)
        drawMovementGraphSample(movementContext, movementCanvas, delta, pixelRatio)
        drawEnvelopeGraphSample(speedContext, speedCanvas, movementEnvelope.current, pixelRatio)
        pendingDelta.current = { x: 0, y: 0 }
        lastSampleTime = time
      }
      animationFrame = requestAnimationFrame(renderFrame)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('pointermove', handlePointerMove, { capture: true })
    window.addEventListener('pointerleave', handlePointerLeave)
    animationFrame = requestAnimationFrame(renderFrame)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('pointermove', handlePointerMove, { capture: true })
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [])

  return (
    <div className="cursor-movement-graphs">
      <canvas
        ref={movementCanvasRef}
        className="cursor-movement-graph"
        width={CSS_WIDTH}
        height={CSS_HEIGHT}
        aria-label="Cursor X and Y movement graph"
      />
      <canvas
        ref={speedCanvasRef}
        className="cursor-movement-graph cursor-movement-graph--speed"
        width={CSS_WIDTH}
        height={CSS_HEIGHT}
        aria-label="Cursor movement speed envelope graph"
      />
    </div>
  )
}

function clearGraph(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = '#020608'
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function drawMovementGraphSample(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  delta: CursorMovementDelta,
  pixelRatio: number,
): void {
  const scroll = Math.max(1, Math.round(pixelRatio))
  const width = canvas.width
  const height = canvas.height
  const centerY = height / 2
  const amplitude = Math.max(1, centerY - 2 * pixelRatio)
  const sample = resolveCursorMovementGraphSample(delta)

  context.globalCompositeOperation = 'copy'
  context.drawImage(canvas, scroll, 0, width - scroll, height, 0, 0, width - scroll, height)

  context.globalCompositeOperation = 'source-over'
  context.fillStyle = '#020608'
  context.fillRect(width - scroll, 0, scroll, height)
  context.fillStyle = 'rgba(95, 126, 132, 0.34)'
  context.fillRect(width - scroll, Math.round(centerY), scroll, Math.max(1, Math.round(pixelRatio)))

  context.globalCompositeOperation = 'lighter'
  drawSampleBar(context, width - scroll, centerY, sample.x, amplitude, scroll, 'rgba(255, 48, 40, 0.82)')
  drawSampleBar(context, width - scroll, centerY, sample.y, amplitude, scroll, 'rgba(36, 116, 255, 0.82)')
}

function drawEnvelopeGraphSample(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  value: number,
  pixelRatio: number,
): void {
  const scroll = Math.max(1, Math.round(pixelRatio))
  const width = canvas.width
  const height = canvas.height
  const baselineY = height - Math.max(2, Math.round(2 * pixelRatio))
  const amplitude = Math.max(1, baselineY - 2 * pixelRatio)
  const sample = Math.min(Math.max(value, 0), 1)

  context.globalCompositeOperation = 'copy'
  context.drawImage(canvas, scroll, 0, width - scroll, height, 0, 0, width - scroll, height)

  context.globalCompositeOperation = 'source-over'
  context.fillStyle = '#020608'
  context.fillRect(width - scroll, 0, scroll, height)
  context.fillStyle = 'rgba(95, 126, 132, 0.24)'
  context.fillRect(width - scroll, baselineY, scroll, Math.max(1, Math.round(pixelRatio)))

  context.globalCompositeOperation = 'lighter'
  context.fillStyle = 'rgba(60, 235, 94, 0.86)'
  context.fillRect(width - scroll, baselineY - sample * amplitude, scroll, Math.max(1, sample * amplitude))
}

function drawSampleBar(
  context: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  value: number,
  amplitude: number,
  width: number,
  color: string,
): void {
  const endY = centerY - value * amplitude
  const top = Math.min(centerY, endY)
  const height = Math.max(1, Math.abs(endY - centerY))

  context.fillStyle = color
  context.fillRect(x, top, width, height)
}
