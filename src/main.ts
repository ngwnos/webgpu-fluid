import './styles.css'
import {
  WHITE_DYE_FLUID_DEFAULTS,
  createWhiteDyeFluidSimulation,
} from './fluid'
import {
  GridSelection,
  beginGridPaint,
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
const statusElement = document.querySelector<HTMLDivElement>('#status')

if (!canvas || !statusElement) {
  throw new Error('Missing required DOM nodes.')
}

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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
    renderPixelRatio = pixelRatio
    const width = Math.max(1, Math.round(window.innerWidth * pixelRatio))
    const height = Math.max(1, Math.round(window.innerHeight * pixelRatio))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      simulation.resize(width, height)
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

    simulation.step(dt)
    simulation.render(context.getCurrentTexture().createView(), format, {
      grid: {
        cellSizePx: gridCellSizePx(),
        lineWidthPx: renderPixelRatio,
        opacity: 0.48,
        activeCells: {
          columns: gridSelection.columns,
          rows: gridSelection.rows,
          data: gridSelection.toMaskWords(),
          version: gridSelection.version,
        },
      },
    })
    animationFrame = requestAnimationFrame(frame)
  }

  const getGridCell = (event: PointerEvent): GridCell | null => {
    const rect = canvas.getBoundingClientRect()
    const layout = syncGridSelection()
    return resolveGridCell(layout, {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    })
  }

  const getFluidPointer = (event: PointerEvent): NormalizedPointerPoint => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: clamp01((event.clientX - rect.left) / Math.max(1, rect.width)),
      y: clamp01((event.clientY - rect.top) / Math.max(1, rect.height)),
    }
  }

  const addFluidSplat = (event: PointerEvent, prime = false) => {
    const point = getFluidPointer(event)
    simulation.addSplat(createPointerSplatOptions(point, lastFluidPointer, prime))
    lastFluidPointer = point
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
    addFluidSplat(event, true)
    const cell = getGridCell(event)
    activePaint = null
    lastPaintCell = null
    if (!cell) return

    activePaint = beginGridPaint(gridSelection, cell)
    lastPaintCell = cell
  }

  const continuePaint = (event: PointerEvent) => {
    addFluidSplat(event)
    const cell = activePaint ? getGridCell(event) : null
    if (cell) paintToCell(cell)
  }

  const clearPaint = () => {
    activePaint = null
    lastPaintCell = null
    lastFluidPointer = null
  }

  canvas.addEventListener('pointerdown', beginPaint)
  canvas.addEventListener('pointermove', continuePaint)
  canvas.addEventListener('pointerup', clearPaint)
  canvas.addEventListener('pointerleave', clearPaint)
  canvas.addEventListener('pointercancel', clearPaint)
  window.addEventListener('resize', resize)
  resize()
  animationFrame = requestAnimationFrame(frame)

  window.addEventListener('pagehide', () => {
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
