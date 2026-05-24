import './styles.css'
import {
  WHITE_DYE_FLUID_DEFAULTS,
  createWhiteDyeFluidSimulation,
} from './fluid'

const MAX_DEVICE_PIXEL_RATIO = 2

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
  let lastPointer: { x: number; y: number } | null = null

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
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
  }

  const frame = (time: number) => {
    const dt = Math.min(Math.max((time - lastFrameTime) / 1000, 1 / 240), 1 / 30)
    lastFrameTime = time

    simulation.step(dt)
    simulation.render(context.getCurrentTexture().createView(), format)
    animationFrame = requestAnimationFrame(frame)
  }

  const addPointerSplat = (event: PointerEvent, prime = false) => {
    const rect = canvas.getBoundingClientRect()
    const x = clamp01((event.clientX - rect.left) / Math.max(1, rect.width))
    const y = clamp01((event.clientY - rect.top) / Math.max(1, rect.height))
    const previous = lastPointer

    simulation.addSplat({
      x,
      y,
      strength: prime || !previous ? 0.65 : 0.9,
      velocityX: previous ? previous.x - x : 0,
      velocityY: previous ? previous.y - y : 0,
      segmentScale: 0.45,
      radiusScale: prime ? 1.45 : 1,
      ...(previous ? { lastX: previous.x, lastY: previous.y } : {}),
    })
    lastPointer = { x, y }
  }

  const clearPointer = () => {
    lastPointer = null
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId)
    addPointerSplat(event, true)
  })
  canvas.addEventListener('pointermove', addPointerSplat)
  canvas.addEventListener('pointerup', clearPointer)
  canvas.addEventListener('pointerleave', clearPointer)
  canvas.addEventListener('pointercancel', clearPointer)
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
