import './styles.css'
import { createRoot } from 'react-dom/client'

import { AppMenu } from './AppMenu'
import { resolveCanvasViewport } from './canvasViewport'
import { getCellPlacementMode } from './cellPlacementMode'
import {
  CURSOR_MOVEMENT_SAMPLE_INTERVAL_MS,
  advanceCursorMovementEnvelope,
  type CursorMovementDelta,
} from './cursorMovementGraphModel'
import {
  WHITE_DYE_FLUID_DEFAULTS,
  createWhiteDyeFluidSimulation,
} from './fluid'
import {
  GridSelection,
  beginGridPaint,
  createGridMask,
  paintGridCell,
  resolveGridCell,
  resolveGridCellSegment,
  resolveGridLayout,
  type GridCell,
  type GridPaintAction,
} from './gridLayout'
import { createPointerSplatOptions, type NormalizedPointerPoint } from './pointerSplat'

const MAX_DEVICE_PIXEL_RATIO = 2
const GRID_CELL_SIZE_CSS_PX = 40

type RuntimeStatus = 'unavailable' | 'error'

const canvas = document.querySelector<HTMLCanvasElement>('#fluid')
const menuElement = document.querySelector<HTMLDivElement>('#menu')
const statusElement = document.querySelector<HTMLDivElement>('#status')

if (!canvas || !menuElement || !statusElement) {
  throw new Error('Missing required DOM nodes.')
}

createRoot(menuElement).render(<AppMenu />)
void start(canvas, statusElement)

async function start(canvas: HTMLCanvasElement, statusElement: HTMLElement): Promise<void> {
  const gpu = navigator.gpu
  if (!gpu) {
    writeStatus(statusElement, 'unavailable', 'navigator.gpu is unavailable')
    return
  }

  const adapter = await gpu.requestAdapter()
  if (!adapter) {
    writeStatus(statusElement, 'unavailable', 'WebGPU adapter unavailable')
    return
  }

  const device = await adapter.requestDevice()
  const context = canvas.getContext('webgpu') as GPUCanvasContext | null
  if (!context) {
    device.destroy()
    writeStatus(statusElement, 'unavailable', 'WebGPU canvas context unavailable')
    return
  }

  device.addEventListener('uncapturederror', (event) => {
    writeStatus(statusElement, 'error', event.error.message)
  })
  statusElement.textContent = ''

  const format = gpu.getPreferredCanvasFormat()
  const simulation = createWhiteDyeFluidSimulation(device, {
    dyeResolution: WHITE_DYE_FLUID_DEFAULTS.dyeResolution,
    simResolution: WHITE_DYE_FLUID_DEFAULTS.simResolution,
  })

  let lastFrameTime = performance.now()
  let animationFrame = 0
  let renderPixelRatio = 1
  let gridSelection = new GridSelection(0, 0)
  let activePaint: GridPaintAction | null = null
  let lastPaintCell: GridCell | null = null
  let lastFluidPointer: NormalizedPointerPoint | null = null
  let lastCursorPixel: { readonly x: number; readonly y: number } | null = null
  let pendingCursorDelta: CursorMovementDelta = { x: 0, y: 0 }
  let cursorMovementEnvelope = 0
  let lastCursorMovementSampleTime = performance.now()

  const gridCellSizePx = () => GRID_CELL_SIZE_CSS_PX * renderPixelRatio

  const syncGridSelection = () => {
    const layout = resolveGridLayout({ width: canvas.width, height: canvas.height }, gridCellSizePx())
    if (gridSelection.columns !== layout.columns || gridSelection.rows !== layout.rows) {
      gridSelection = new GridSelection(layout.columns, layout.rows)
      activePaint = null
      lastPaintCell = null
    }
    return layout
  }

  const resize = () => {
    const viewport = resolveCanvasViewport(
      {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      },
      Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
    )
    renderPixelRatio = viewport.pixelRatio

    if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
      canvas.width = viewport.width
      canvas.height = viewport.height
      simulation.resize(viewport.width, viewport.height)
    }

    context.configure({
      device,
      format,
      alphaMode: 'opaque',
    })
    syncGridSelection()
  }

  const frame = (time: number) => {
    const dt = Math.min(Math.max((time - lastFrameTime) / 1000, 1 / 240), 1 / 30)
    lastFrameTime = time

    const gridMask = createGridMask({ width: canvas.width, height: canvas.height }, gridCellSizePx(), gridSelection)
    simulation.setObstacleMask(gridMask)
    simulation.step(dt)
    simulation.render(context.getCurrentTexture().createView(), format, {
      grid: {
        cellSizePx: gridCellSizePx(),
        lineWidthPx: renderPixelRatio,
        opacity: 0.48,
        activeCells: gridMask,
      },
    })
    animationFrame = requestAnimationFrame(frame)
  }

  const getCanvasPoint = (event: PointerEvent): { readonly x: number; readonly y: number } => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    }
  }

  const getFluidPointer = (point: { readonly x: number; readonly y: number }): NormalizedPointerPoint => {
    return {
      x: clamp01(point.x / canvas.width),
      y: clamp01(point.y / canvas.height),
    }
  }

  const sampleCursorMovementEnvelope = (event: PointerEvent): number => {
    const pixel = { x: event.clientX, y: event.clientY }
    const fallbackDelta = lastCursorPixel
      ? { x: pixel.x - lastCursorPixel.x, y: pixel.y - lastCursorPixel.y }
      : { x: 0, y: 0 }
    const movementX = Number.isFinite(event.movementX) && event.movementX !== 0 ? event.movementX : fallbackDelta.x
    const movementY = Number.isFinite(event.movementY) && event.movementY !== 0 ? event.movementY : fallbackDelta.y

    pendingCursorDelta = {
      x: pendingCursorDelta.x + movementX,
      y: pendingCursorDelta.y + movementY,
    }
    lastCursorPixel = pixel

    const now = performance.now()
    const elapsedMs = now - lastCursorMovementSampleTime
    if (elapsedMs >= CURSOR_MOVEMENT_SAMPLE_INTERVAL_MS) {
      cursorMovementEnvelope = advanceCursorMovementEnvelope(cursorMovementEnvelope, pendingCursorDelta, elapsedMs)
      pendingCursorDelta = { x: 0, y: 0 }
      lastCursorMovementSampleTime = now
    }

    return cursorMovementEnvelope
  }

  const resetFluidSplatTrail = () => {
    lastFluidPointer = null
    lastCursorPixel = null
    pendingCursorDelta = { x: 0, y: 0 }
    cursorMovementEnvelope = 0
    lastCursorMovementSampleTime = performance.now()
  }

  const addFluidSplat = (event: PointerEvent, prime = false): GridCell | null => {
    const canvasPoint = getCanvasPoint(event)
    const cell = resolveGridCell(syncGridSelection(), canvasPoint)
    if (!cell) {
      resetFluidSplatTrail()
      return null
    }

    const point = getFluidPointer(canvasPoint)
    const movementStrength = sampleCursorMovementEnvelope(event)
    simulation.addSplat(createPointerSplatOptions(point, lastFluidPointer, prime, { movementStrength }))
    lastFluidPointer = point
    return cell
  }

  const paintToCell = (cell: GridCell) => {
    if (!activePaint) return

    const cells = lastPaintCell ? resolveGridCellSegment(lastPaintCell, cell) : [cell]
    for (const nextCell of cells) {
      paintGridCell(gridSelection, activePaint, nextCell)
    }
    lastPaintCell = cell
  }

  const beginPaint = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId)
    const cell = addFluidSplat(event, true)
    activePaint = null
    lastPaintCell = null
    if (!cell) return

    activePaint = beginGridPaint(gridSelection, cell, getCellPlacementMode())
    lastPaintCell = cell
  }

  const continuePaint = (event: PointerEvent) => {
    const cell = addFluidSplat(event)
    if (cell) paintToCell(cell)
  }

  const clearPaint = () => {
    activePaint = null
    lastPaintCell = null
    resetFluidSplatTrail()
  }

  canvas.addEventListener('pointerdown', beginPaint)
  canvas.addEventListener('pointermove', continuePaint)
  canvas.addEventListener('pointerup', clearPaint)
  canvas.addEventListener('pointerleave', clearPaint)
  canvas.addEventListener('pointercancel', clearPaint)
  window.addEventListener('resize', resize)
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  resize()
  animationFrame = requestAnimationFrame(frame)

  window.addEventListener('pagehide', () => {
    resizeObserver.disconnect()
    cancelAnimationFrame(animationFrame)
    simulation.destroy()
    device.destroy()
  })
}

function writeStatus(element: HTMLElement, state: RuntimeStatus, message: string): void {
  element.dataset.state = state
  element.textContent = message
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}
