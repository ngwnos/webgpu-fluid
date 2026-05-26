import { useEffect, useRef } from 'react'

import {
  CURSOR_MOVEMENT_GRAPH_HEIGHT,
  CURSOR_MOVEMENT_GRAPH_WIDTH,
  resolveCursorMovementGraphSample,
  type CursorMovementDelta,
} from './cursorMovementGraphModel'

const CSS_WIDTH = CURSOR_MOVEMENT_GRAPH_WIDTH
const CSS_HEIGHT = CURSOR_MOVEMENT_GRAPH_HEIGHT
const GRAPH_SAMPLE_INTERVAL_MS = 1000 / 30

export function CursorMovementGraph(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pendingDelta = useRef<CursorMovementDelta>({ x: 0, y: 0 })
  const lastPointer = useRef<{ readonly x: number; readonly y: number } | null>(null)

  useEffect(() => {
    let animationFrame = 0
    let context: CanvasRenderingContext2D | null = null
    let pixelRatio = 1
    let lastSampleTime = performance.now()

    const canvas = canvasRef.current
    if (!canvas) return undefined

    const resizeCanvas = () => {
      const nextPixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      const width = Math.round(CSS_WIDTH * nextPixelRatio)
      const height = Math.round(CSS_HEIGHT * nextPixelRatio)

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      pixelRatio = nextPixelRatio
      context = canvas.getContext('2d')
      if (context) clearGraph(context, canvas)
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
      if (context && time - lastSampleTime >= GRAPH_SAMPLE_INTERVAL_MS) {
        drawGraphSample(context, canvas, pendingDelta.current, pixelRatio)
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
    <canvas
      ref={canvasRef}
      className="cursor-movement-graph"
      width={CSS_WIDTH}
      height={CSS_HEIGHT}
      aria-label="Cursor movement graph"
    />
  )
}

function clearGraph(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = '#020608'
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function drawGraphSample(
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
