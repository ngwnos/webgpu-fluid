import { resolveGridLayout } from './gridLayout'

const GPU_BUFFER_USAGE_FLAGS = {
  copyDst: 0x0008,
  storage: 0x0080,
  uniform: 0x0040,
} as const

const GPU_TEXTURE_USAGE_FLAGS = {
  copySrc: 0x01,
  textureBinding: 0x04,
  storageBinding: 0x08,
} as const

const GPU_SHADER_STAGE_FLAGS = {
  vertex: 0x1,
  fragment: 0x2,
  compute: 0x4,
} as const

export type FluidResolution = {
  readonly width: number
  readonly height: number
}

export type WhiteDyeFluidOptions = {
  readonly simResolution?: number
  readonly dyeResolution?: number
  readonly pressureIterations?: number
  readonly velocityDissipation?: number
  readonly dyeDissipation?: number
  readonly pressureDecay?: number
  readonly curlStrength?: number
  readonly splatRadius?: number
  readonly splatForce?: number
  readonly maxVelocity?: number
}

export type WhiteDyeFluidResolvedOptions = Required<WhiteDyeFluidOptions>

export type GridOverlayOptions = {
  readonly cellSizePx: number
  readonly lineWidthPx?: number
  readonly opacity?: number
  readonly activeCells?: GridOverlayMask
}

export type GridOverlayMask = {
  readonly columns: number
  readonly rows: number
  readonly data: Uint32Array
  readonly version: number
}

export type FluidObstacleMask = GridOverlayMask & {
  readonly cellSizePx: number
  readonly marginX: number
  readonly marginY: number
}

export type WhiteDyeFluidRenderOptions = {
  readonly grid?: GridOverlayOptions
}

export type WhiteDyeFluidSplatOptions = {
  readonly x: number
  readonly y: number
  readonly strength?: number
  readonly velocityX?: number
  readonly velocityY?: number
  readonly lastX?: number
  readonly lastY?: number
  readonly radius?: number
  readonly radiusScale?: number
  readonly segmentScale?: number
}

export type WhiteDyeFluidSplatEvent = {
  readonly point: { readonly x: number; readonly y: number }
  readonly velocity: { readonly x: number; readonly y: number }
  readonly radius: number
  readonly strength: number
}

type TexturePair = readonly [GPUTexture, GPUTexture]

type FluidPipelines = {
  readonly bindGroupLayout: GPUBindGroupLayout
  readonly velocitySplat: GPUComputePipeline
  readonly dyeSplat: GPUComputePipeline
  readonly curl: GPUComputePipeline
  readonly vorticity: GPUComputePipeline
  readonly divergence: GPUComputePipeline
  readonly pressureClear: GPUComputePipeline
  readonly pressureJacobi: GPUComputePipeline
  readonly gradientSubtract: GPUComputePipeline
  readonly velocityAdvection: GPUComputePipeline
  readonly dyeAdvection: GPUComputePipeline
}

type FluidTextures = {
  readonly velocity: TexturePair
  readonly dye: TexturePair
  readonly pressure: TexturePair
  readonly divergence: GPUTexture
  readonly curl: GPUTexture
}

export const WHITE_DYE_FLUID_TEXTURE_FORMAT = 'rgba16float' satisfies GPUTextureFormat
export const WHITE_DYE_FLUID_WORKGROUP_SIZE = 8
export const WHITE_DYE_FLUID_MAX_PENDING_SPLATS = 256
export const WHITE_DYE_FLUID_MAX_SPLATS_PER_FRAME = 32
export const WHITE_DYE_FLUID_MAX_SPLAT_SEGMENTS = 96

export const WHITE_DYE_FLUID_DEFAULTS = {
  simResolution: 128,
  dyeResolution: 512,
  pressureIterations: 20,
  velocityDissipation: 0.35,
  dyeDissipation: 0.2,
  pressureDecay: 0.92,
  curlStrength: 1.05,
  splatRadius: 0.035,
  splatForce: 4200,
  maxVelocity: 240,
} as const satisfies WhiteDyeFluidResolvedOptions

const PARAM_FLOAT_COUNT = 36
const PARAM_BYTE_LENGTH = PARAM_FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT
const GRID_PARAM_FLOAT_COUNT = 12
const GRID_PARAM_BYTE_LENGTH = GRID_PARAM_FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT
const MIN_DELTA = 1 / 240
const MAX_DELTA = 1 / 30

export function resolveFluidOptions(options: WhiteDyeFluidOptions = {}): WhiteDyeFluidResolvedOptions {
  return {
    simResolution: clampInteger(options.simResolution ?? WHITE_DYE_FLUID_DEFAULTS.simResolution, 16, 2048),
    dyeResolution: clampInteger(options.dyeResolution ?? WHITE_DYE_FLUID_DEFAULTS.dyeResolution, 16, 4096),
    pressureIterations: clampInteger(
      options.pressureIterations ?? WHITE_DYE_FLUID_DEFAULTS.pressureIterations,
      1,
      80,
    ),
    velocityDissipation: clampFinite(
      options.velocityDissipation ?? WHITE_DYE_FLUID_DEFAULTS.velocityDissipation,
      0,
      20,
    ),
    dyeDissipation: clampFinite(options.dyeDissipation ?? WHITE_DYE_FLUID_DEFAULTS.dyeDissipation, 0, 20),
    pressureDecay: clampFinite(options.pressureDecay ?? WHITE_DYE_FLUID_DEFAULTS.pressureDecay, 0, 1.2),
    curlStrength: clampFinite(options.curlStrength ?? WHITE_DYE_FLUID_DEFAULTS.curlStrength, 0, 8),
    splatRadius: clampFinite(options.splatRadius ?? WHITE_DYE_FLUID_DEFAULTS.splatRadius, 0.001, 0.4),
    splatForce: clampFinite(options.splatForce ?? WHITE_DYE_FLUID_DEFAULTS.splatForce, 0, 12000),
    maxVelocity: clampFinite(options.maxVelocity ?? WHITE_DYE_FLUID_DEFAULTS.maxVelocity, 1, 2000),
  }
}

export function resolveFluidResolution(viewport: FluidResolution, baseResolution: number): FluidResolution {
  const aspect = Math.max(1, viewport.width) / Math.max(1, viewport.height)
  let width = Math.max(1, Math.round(baseResolution))
  let height = width

  if (aspect > 1) {
    width = Math.round(baseResolution * aspect)
  } else {
    height = Math.round(baseResolution / Math.max(aspect, 0.000001))
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
}

export function createWhiteDyeFluidSplatEvents(
  options: WhiteDyeFluidSplatOptions,
  config: Pick<WhiteDyeFluidResolvedOptions, 'simResolution' | 'splatForce' | 'splatRadius'> = WHITE_DYE_FLUID_DEFAULTS,
): WhiteDyeFluidSplatEvent[] {
  const endX = clampFinite(options.x, 0, 1)
  const endY = clampFinite(options.y, 0, 1)
  const startX = options.lastX === undefined ? endX : clampFinite(options.lastX, 0, 1)
  const startY = options.lastY === undefined ? endY : clampFinite(options.lastY, 0, 1)
  const dx = endX - startX
  const dy = endY - startY
  const distance = Math.hypot(dx, dy)
  const segmentScale = Math.max(options.segmentScale ?? 1, 0.001)
  const segments = Math.min(
    WHITE_DYE_FLUID_MAX_SPLAT_SEGMENTS,
    Math.max(1, Math.ceil(distance * config.simResolution * 1.5 * segmentScale)),
  )
  const strength = Math.max(options.strength ?? 1, 0.02)
  const radiusScale = Math.max(options.radiusScale ?? 1, 0.05)
  const radius = clampFinite((options.radius ?? config.splatRadius) * strength * radiusScale, 0.0005, 0.5)
  const velocityX = -(options.velocityX ?? 0) * config.splatForce * strength
  const velocityY = -(options.velocityY ?? 0) * config.splatForce * strength
  const events: WhiteDyeFluidSplatEvent[] = []

  for (let index = 0; index < segments; index += 1) {
    const t = (index + 1) / segments
    events.push({
      point: {
        x: startX + dx * t,
        y: startY + dy * t,
      },
      velocity: { x: velocityX, y: velocityY },
      radius,
      strength,
    })
  }

  return events
}

export function createWhiteDyeFluidSimulation(
  device: GPUDevice,
  options: WhiteDyeFluidOptions = {},
): WhiteDyeFluidSimulation {
  return new WhiteDyeFluidSimulation(device, options)
}

export class WhiteDyeFluidSimulation {
  readonly options: WhiteDyeFluidResolvedOptions

  private textures: FluidTextures | null = null
  private pipelines: FluidPipelines
  private renderPipeline: GPURenderPipeline | null = null
  private renderPipelineFormat: GPUTextureFormat | null = null
  private gridRenderPipeline: GPURenderPipeline | null = null
  private gridRenderPipelineFormat: GPUTextureFormat | null = null
  private readonly sampler: GPUSampler
  private readonly uniformBuffer: GPUBuffer
  private readonly gridUniformBuffer: GPUBuffer
  private gridMaskBuffer: GPUBuffer | null = null
  private gridMaskCapacity = 0
  private obstacleMaskBuffer: GPUBuffer | null = null
  private obstacleMaskCapacity = 0
  private obstacleMaskKey = ''
  private obstacleMask: FluidObstacleMask | null = null
  private readonly params = new Float32Array(PARAM_FLOAT_COUNT)
  private readonly gridParams = new Float32Array(GRID_PARAM_FLOAT_COUNT)
  private readonly pendingSplats: WhiteDyeFluidSplatEvent[] = []
  private pendingSplatHead = 0
  private velocityReadIndex = 0
  private dyeReadIndex = 0
  private pressureReadIndex = 0
  private simResolution: FluidResolution = { width: 1, height: 1 }
  private dyeResolution: FluidResolution = { width: 1, height: 1 }
  private viewport: FluidResolution = { width: 1, height: 1 }
  private timeSeconds = 0

  constructor(
    private readonly device: GPUDevice,
    options: WhiteDyeFluidOptions = {},
  ) {
    this.options = resolveFluidOptions(options)
    this.sampler = device.createSampler({
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'nearest',
    })
    this.uniformBuffer = device.createBuffer({
      size: PARAM_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE_FLAGS.uniform | GPU_BUFFER_USAGE_FLAGS.copyDst,
    })
    this.gridUniformBuffer = device.createBuffer({
      size: GRID_PARAM_BYTE_LENGTH,
      usage: GPU_BUFFER_USAGE_FLAGS.uniform | GPU_BUFFER_USAGE_FLAGS.copyDst,
    })
    this.pipelines = createFluidPipelines(device)
    this.resize(1, 1)
  }

  get dyeTexture(): GPUTexture {
    return getPairTexture(this.getTextures().dye, this.dyeReadIndex)
  }

  get velocityTexture(): GPUTexture {
    return getPairTexture(this.getTextures().velocity, this.velocityReadIndex)
  }

  get size(): { readonly viewport: FluidResolution; readonly sim: FluidResolution; readonly dye: FluidResolution } {
    return {
      viewport: this.viewport,
      sim: this.simResolution,
      dye: this.dyeResolution,
    }
  }

  get pendingSplatCount(): number {
    return this.pendingSplats.length - this.pendingSplatHead
  }

  resize(width: number, height: number): void {
    const nextViewport = {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    }
    const nextSim = resolveFluidResolution(nextViewport, this.options.simResolution)
    const nextDye = resolveFluidResolution(nextViewport, this.options.dyeResolution)

    if (
      this.textures &&
      nextViewport.width === this.viewport.width &&
      nextViewport.height === this.viewport.height &&
      nextSim.width === this.simResolution.width &&
      nextSim.height === this.simResolution.height &&
      nextDye.width === this.dyeResolution.width &&
      nextDye.height === this.dyeResolution.height
    ) {
      return
    }

    this.destroyTextures()
    this.viewport = nextViewport
    this.simResolution = nextSim
    this.dyeResolution = nextDye
    this.textures = {
      velocity: createTexturePair(this.device, nextSim),
      dye: createTexturePair(this.device, nextDye),
      pressure: createTexturePair(this.device, nextSim),
      divergence: createFluidTexture(this.device, nextSim),
      curl: createFluidTexture(this.device, nextSim),
    }
    this.velocityReadIndex = 0
    this.dyeReadIndex = 0
    this.pressureReadIndex = 0
    this.pendingSplats.length = 0
    this.pendingSplatHead = 0
  }

  addSplat(options: WhiteDyeFluidSplatOptions): void {
    for (const event of createWhiteDyeFluidSplatEvents(options, this.options)) {
      this.pushPendingSplat(event)
    }
  }

  setObstacleMask(mask: FluidObstacleMask | null): void {
    const cellCount = mask ? mask.columns * mask.rows : 0
    if (
      !mask ||
      mask.cellSizePx <= 0 ||
      mask.columns <= 0 ||
      mask.rows <= 0 ||
      mask.data.length < cellCount
    ) {
      this.obstacleMask = null
      this.obstacleMaskKey = ''
      return
    }

    this.obstacleMask = mask
    const key = [
      mask.cellSizePx,
      mask.columns,
      mask.rows,
      mask.marginX,
      mask.marginY,
      mask.version,
    ].join(':')
    if (key === this.obstacleMaskKey) return

    this.obstacleMaskKey = key
    this.writeObstacleMaskBuffer(mask)
  }

  step(deltaSeconds = 1 / 60): void {
    const textures = this.getTextures()

    const dt = clampFinite(deltaSeconds || 1 / 60, MIN_DELTA, MAX_DELTA)
    this.timeSeconds += dt
    this.applyPendingSplats(dt)

    if (this.options.curlStrength > 0.0001) {
      this.runFixedTargetPass(
        this.pipelines.curl,
        getPairTexture(textures.velocity, this.velocityReadIndex),
        textures.curl,
        this.simResolution,
      )
      this.runVelocityPass(this.pipelines.vorticity, textures.curl)
    }

    this.runFixedTargetPass(
      this.pipelines.divergence,
      getPairTexture(textures.velocity, this.velocityReadIndex),
      textures.divergence,
      this.simResolution,
    )
    this.runPressurePass(this.pipelines.pressureClear)

    for (let index = 0; index < this.options.pressureIterations; index += 1) {
      this.runPressurePass(this.pipelines.pressureJacobi, textures.divergence)
    }

    this.runGradientSubtract()
    this.runVelocityPass(this.pipelines.velocityAdvection)
    this.runDyeAdvection()
  }

  render(targetView: GPUTextureView, format: GPUTextureFormat, options: WhiteDyeFluidRenderOptions = {}): void {
    const textures = this.getTextures()
    const pipeline = this.getRenderPipeline(format)
    const gridPipeline = options.grid ? this.getGridRenderPipeline(format) : null
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: getPairTexture(textures.dye, this.dyeReadIndex).createView() },
      ],
    })
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(3)

    if (options.grid && gridPipeline) {
      const gridBindGroup = this.createGridBindGroup(gridPipeline, options.grid)
      if (gridBindGroup) {
        pass.setPipeline(gridPipeline)
        pass.setBindGroup(0, gridBindGroup)
        pass.draw(3)
      }
    }

    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  destroy(): void {
    this.destroyTextures()
    this.destroyGridMaskBuffer()
    this.destroyObstacleMaskBuffer()
    this.uniformBuffer.destroy()
    this.gridUniformBuffer.destroy()
  }

  private applyPendingSplats(dt: number): void {
    const queued = this.pendingSplats.length - this.pendingSplatHead
    if (queued <= 0) return

    const count = Math.min(queued, WHITE_DYE_FLUID_MAX_SPLATS_PER_FRAME)
    const end = this.pendingSplatHead + count
    const aspect = this.viewport.width / Math.max(1, this.viewport.height)
    const aspectX = aspect >= 1 ? aspect : 1
    const aspectY = aspect >= 1 ? 1 : 1 / Math.max(aspect, 0.000001)

    for (let index = this.pendingSplatHead; index < end; index += 1) {
      const event = this.pendingSplats[index]
      if (!event) continue

      this.writeParams(dt, {
        x: event.point.x,
        y: event.point.y,
        radius: event.radius,
        strength: event.strength,
        velocityX: event.velocity.x,
        velocityY: event.velocity.y,
        aspectX,
        aspectY,
      })
      this.runVelocityPass(this.pipelines.velocitySplat)
      this.runDyePass(this.pipelines.dyeSplat)
    }

    this.pendingSplatHead = end
    if (this.pendingSplatHead >= this.pendingSplats.length) {
      this.pendingSplats.length = 0
      this.pendingSplatHead = 0
    } else if (this.pendingSplatHead > 256 && this.pendingSplatHead * 2 > this.pendingSplats.length) {
      this.pendingSplats.splice(0, this.pendingSplatHead)
      this.pendingSplatHead = 0
    }
  }

  private pushPendingSplat(event: WhiteDyeFluidSplatEvent): void {
    if (this.pendingSplatCount >= WHITE_DYE_FLUID_MAX_PENDING_SPLATS) {
      this.pendingSplatHead += 1
    }
    this.pendingSplats.push(event)
  }

  private runVelocityPass(pipeline: GPUComputePipeline, secondaryTexture?: GPUTexture): void {
    const textures = this.getTextures()
    const read = this.velocityReadIndex
    const source = getPairTexture(textures.velocity, read)
    const target = getPairTexture(textures.velocity, 1 - read)
    this.runComputePass(
      pipeline,
      source,
      secondaryTexture ?? source,
      target,
      this.simResolution,
    )
    this.velocityReadIndex = 1 - read
  }

  private runDyePass(pipeline: GPUComputePipeline, secondaryTexture?: GPUTexture): void {
    const textures = this.getTextures()
    const read = this.dyeReadIndex
    const source = getPairTexture(textures.dye, read)
    const target = getPairTexture(textures.dye, 1 - read)
    this.runComputePass(
      pipeline,
      source,
      secondaryTexture ?? source,
      target,
      this.dyeResolution,
    )
    this.dyeReadIndex = 1 - read
  }

  private runPressurePass(pipeline: GPUComputePipeline, secondaryTexture?: GPUTexture): void {
    const textures = this.getTextures()
    const read = this.pressureReadIndex
    const source = getPairTexture(textures.pressure, read)
    const target = getPairTexture(textures.pressure, 1 - read)
    this.runComputePass(
      pipeline,
      source,
      secondaryTexture ?? source,
      target,
      this.simResolution,
    )
    this.pressureReadIndex = 1 - read
  }

  private runFixedTargetPass(
    pipeline: GPUComputePipeline,
    sourceTexture: GPUTexture,
    targetTexture: GPUTexture,
    targetSize: FluidResolution,
  ): void {
    this.runComputePass(pipeline, sourceTexture, sourceTexture, targetTexture, targetSize)
  }

  private runGradientSubtract(): void {
    const textures = this.getTextures()
    const velocityRead = this.velocityReadIndex
    const target = getPairTexture(textures.velocity, 1 - velocityRead)
    this.runComputePass(
      this.pipelines.gradientSubtract,
      getPairTexture(textures.velocity, velocityRead),
      getPairTexture(textures.pressure, this.pressureReadIndex),
      target,
      this.simResolution,
    )
    this.velocityReadIndex = 1 - velocityRead
  }

  private runDyeAdvection(): void {
    const textures = this.getTextures()
    const dyeRead = this.dyeReadIndex
    const target = getPairTexture(textures.dye, 1 - dyeRead)
    this.runComputePass(
      this.pipelines.dyeAdvection,
      getPairTexture(textures.velocity, this.velocityReadIndex),
      getPairTexture(textures.dye, dyeRead),
      target,
      this.dyeResolution,
    )
    this.dyeReadIndex = 1 - dyeRead
  }

  private runComputePass(
    pipeline: GPUComputePipeline,
    sourceTexture: GPUTexture,
    secondaryTexture: GPUTexture,
    targetTexture: GPUTexture,
    targetSize: FluidResolution,
  ): void {
    this.writeParams(this.params[8] || 1 / 60)

    const bindGroup = this.device.createBindGroup({
      layout: this.pipelines.bindGroupLayout,
      entries: [
        { binding: 0, resource: sourceTexture.createView() },
        { binding: 1, resource: secondaryTexture.createView() },
        { binding: 2, resource: targetTexture.createView() },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: { buffer: this.uniformBuffer } },
        { binding: 5, resource: { buffer: this.getObstacleMaskBuffer() } },
      ],
    })
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginComputePass()

    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(
      Math.ceil(targetSize.width / WHITE_DYE_FLUID_WORKGROUP_SIZE),
      Math.ceil(targetSize.height / WHITE_DYE_FLUID_WORKGROUP_SIZE),
    )
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  private writeParams(
    dt: number,
    splat?: {
      readonly x: number
      readonly y: number
      readonly radius: number
      readonly strength: number
      readonly velocityX: number
      readonly velocityY: number
      readonly aspectX: number
      readonly aspectY: number
    },
  ): void {
    this.params[0] = this.simResolution.width
    this.params[1] = this.simResolution.height
    this.params[2] = 1 / this.simResolution.width
    this.params[3] = 1 / this.simResolution.height
    this.params[4] = this.dyeResolution.width
    this.params[5] = this.dyeResolution.height
    this.params[6] = 1 / this.dyeResolution.width
    this.params[7] = 1 / this.dyeResolution.height
    this.params[8] = dt
    this.params[9] = this.timeSeconds
    this.params[10] = this.options.pressureDecay
    this.params[11] = this.options.maxVelocity
    this.params[12] = this.options.velocityDissipation
    this.params[13] = this.options.dyeDissipation
    this.params[14] = this.options.curlStrength
    this.params[15] = 0
    this.params[16] = splat?.x ?? this.params[16] ?? 0.5
    this.params[17] = splat?.y ?? this.params[17] ?? 0.5
    this.params[18] = splat?.radius ?? this.params[18] ?? this.options.splatRadius
    this.params[19] = splat?.strength ?? this.params[19] ?? 1
    this.params[20] = splat?.velocityX ?? this.params[20] ?? 0
    this.params[21] = splat?.velocityY ?? this.params[21] ?? 0
    this.params[22] = splat?.aspectX ?? this.params[22] ?? 1
    this.params[23] = splat?.aspectY ?? this.params[23] ?? 1
    this.params[24] = this.viewport.width
    this.params[25] = this.viewport.height
    this.params[26] = 1 / this.viewport.width
    this.params[27] = 1 / this.viewport.height
    this.params[28] = this.obstacleMask?.cellSizePx ?? 1
    this.params[29] = this.obstacleMask?.columns ?? 0
    this.params[30] = this.obstacleMask?.rows ?? 0
    this.params[31] = this.obstacleMask ? 1 : 0
    this.params[32] = this.obstacleMask?.marginX ?? 0
    this.params[33] = this.obstacleMask?.marginY ?? 0
    this.params[34] = 0
    this.params[35] = 0

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.params)
  }

  private getRenderPipeline(format: GPUTextureFormat): GPURenderPipeline {
    if (this.renderPipeline && this.renderPipelineFormat === format) return this.renderPipeline

    this.renderPipelineFormat = format
    this.renderPipeline = this.device.createRenderPipeline({
      label: 'webgpu-fluid-render-pipeline',
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          label: 'webgpu-fluid-render-vertex',
          code: WHITE_DYE_RENDER_SHADER,
        }),
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: this.device.createShaderModule({
          label: 'webgpu-fluid-render-fragment',
          code: WHITE_DYE_RENDER_SHADER,
        }),
        entryPoint: 'fragmentMain',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })

    return this.renderPipeline
  }

  private getGridRenderPipeline(format: GPUTextureFormat): GPURenderPipeline {
    if (this.gridRenderPipeline && this.gridRenderPipelineFormat === format) return this.gridRenderPipeline

    this.gridRenderPipelineFormat = format
    this.gridRenderPipeline = this.device.createRenderPipeline({
      label: 'webgpu-fluid-grid-overlay-pipeline',
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          label: 'webgpu-fluid-grid-overlay-vertex',
          code: GRID_OVERLAY_SHADER,
        }),
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: this.device.createShaderModule({
          label: 'webgpu-fluid-grid-overlay-fragment',
          code: GRID_OVERLAY_SHADER,
        }),
        entryPoint: 'fragmentMain',
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
      },
    })

    return this.gridRenderPipeline
  }

  private createGridBindGroup(pipeline: GPURenderPipeline, options: GridOverlayOptions): GPUBindGroup | null {
    const layout = resolveGridLayout(this.viewport, options.cellSizePx)
    if (layout.columns <= 0 || layout.rows <= 0) return null

    const lineWidth = clampFinite(options.lineWidthPx ?? 1, 0.25, Math.max(0.25, layout.cellSizePx / 2))
    const opacity = clampFinite(options.opacity ?? 0.5, 0, 1)
    if (opacity <= 0) return null

    this.gridParams[0] = this.viewport.width
    this.gridParams[1] = this.viewport.height
    this.gridParams[2] = 1 / this.viewport.width
    this.gridParams[3] = 1 / this.viewport.height
    this.gridParams[4] = layout.cellSizePx
    this.gridParams[5] = layout.columns
    this.gridParams[6] = layout.rows
    this.gridParams[7] = lineWidth
    this.gridParams[8] = layout.marginX
    this.gridParams[9] = layout.marginY
    this.gridParams[10] = opacity
    this.gridParams[11] = 0

    this.device.queue.writeBuffer(this.gridUniformBuffer, 0, this.gridParams)

    const mask = this.writeGridMaskBuffer(layout.columns * layout.rows, options.activeCells)

    return this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.gridUniformBuffer } },
        { binding: 1, resource: { buffer: mask.buffer, size: mask.byteLength } },
      ],
    })
  }

  private writeGridMaskBuffer(
    cellCount: number,
    activeCells?: GridOverlayMask,
  ): { readonly buffer: GPUBuffer; readonly byteLength: number } {
    const wordsLength = Math.max(1, cellCount)
    const byteLength = wordsLength * Uint32Array.BYTES_PER_ELEMENT

    if (!this.gridMaskBuffer || this.gridMaskCapacity < wordsLength) {
      this.destroyGridMaskBuffer()
      this.gridMaskBuffer = this.device.createBuffer({
        label: 'webgpu-fluid-grid-overlay-mask',
        size: byteLength,
        usage: GPU_BUFFER_USAGE_FLAGS.storage | GPU_BUFFER_USAGE_FLAGS.copyDst,
      })
      this.gridMaskCapacity = wordsLength
    }

    const words = new Uint32Array(wordsLength)
    if (
      activeCells &&
      activeCells.columns * activeCells.rows === cellCount &&
      activeCells.data.length >= cellCount
    ) {
      words.set(activeCells.data.subarray(0, cellCount))
    }
    this.device.queue.writeBuffer(this.gridMaskBuffer, 0, words)

    return { buffer: this.gridMaskBuffer, byteLength }
  }

  private destroyGridMaskBuffer(): void {
    this.gridMaskBuffer?.destroy()
    this.gridMaskBuffer = null
    this.gridMaskCapacity = 0
  }

  private writeObstacleMaskBuffer(mask: FluidObstacleMask): void {
    const cellCount = mask.columns * mask.rows
    const wordsLength = Math.max(1, cellCount)
    const words = new Uint32Array(wordsLength)
    words.set(mask.data.subarray(0, cellCount))

    const buffer = this.ensureObstacleMaskBuffer(wordsLength)
    this.device.queue.writeBuffer(buffer, 0, words)
  }

  private getObstacleMaskBuffer(): GPUBuffer {
    return this.ensureObstacleMaskBuffer(1)
  }

  private ensureObstacleMaskBuffer(wordsLength: number): GPUBuffer {
    const capacity = Math.max(1, wordsLength)
    if (!this.obstacleMaskBuffer || this.obstacleMaskCapacity < capacity) {
      this.destroyObstacleMaskBuffer()
      this.obstacleMaskBuffer = this.device.createBuffer({
        label: 'webgpu-fluid-obstacle-mask',
        size: capacity * Uint32Array.BYTES_PER_ELEMENT,
        usage: GPU_BUFFER_USAGE_FLAGS.storage | GPU_BUFFER_USAGE_FLAGS.copyDst,
      })
      this.obstacleMaskCapacity = capacity
    }

    return this.obstacleMaskBuffer
  }

  private destroyObstacleMaskBuffer(): void {
    this.obstacleMaskBuffer?.destroy()
    this.obstacleMaskBuffer = null
    this.obstacleMaskCapacity = 0
  }

  private destroyTextures(): void {
    if (!this.textures) return

    for (const texture of [
      ...this.textures.velocity,
      ...this.textures.dye,
      ...this.textures.pressure,
      this.textures.divergence,
      this.textures.curl,
    ]) {
      texture.destroy()
    }
    this.textures = null
  }

  private getTextures(): FluidTextures {
    if (!this.textures) {
      throw new Error('WhiteDyeFluidSimulation has no allocated textures.')
    }
    return this.textures
  }
}

function createFluidPipelines(device: GPUDevice): FluidPipelines {
  const bindGroupLayout = createFluidBindGroupLayout(device)
  const pipelineLayout = device.createPipelineLayout({
    label: 'webgpu-fluid-compute-pipeline-layout',
    bindGroupLayouts: [bindGroupLayout],
  })

  return {
    bindGroupLayout,
    velocitySplat: createComputePipeline(device, pipelineLayout, 'velocity-splat', VELOCITY_SPLAT_SHADER),
    dyeSplat: createComputePipeline(device, pipelineLayout, 'dye-splat', DYE_SPLAT_SHADER),
    curl: createComputePipeline(device, pipelineLayout, 'curl', CURL_SHADER),
    vorticity: createComputePipeline(device, pipelineLayout, 'vorticity', VORTICITY_SHADER),
    divergence: createComputePipeline(device, pipelineLayout, 'divergence', DIVERGENCE_SHADER),
    pressureClear: createComputePipeline(device, pipelineLayout, 'pressure-clear', PRESSURE_CLEAR_SHADER),
    pressureJacobi: createComputePipeline(device, pipelineLayout, 'pressure-jacobi', PRESSURE_JACOBI_SHADER),
    gradientSubtract: createComputePipeline(device, pipelineLayout, 'gradient-subtract', GRADIENT_SUBTRACT_SHADER),
    velocityAdvection: createComputePipeline(device, pipelineLayout, 'velocity-advection', VELOCITY_ADVECTION_SHADER),
    dyeAdvection: createComputePipeline(device, pipelineLayout, 'dye-advection', DYE_ADVECTION_SHADER),
  }
}

function createFluidBindGroupLayout(device: GPUDevice): GPUBindGroupLayout {
  return device.createBindGroupLayout({
    label: 'webgpu-fluid-compute-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPU_SHADER_STAGE_FLAGS.compute,
        texture: { sampleType: 'float' },
      },
      {
        binding: 1,
        visibility: GPU_SHADER_STAGE_FLAGS.compute,
        texture: { sampleType: 'float' },
      },
      {
        binding: 2,
        visibility: GPU_SHADER_STAGE_FLAGS.compute,
        storageTexture: {
          access: 'write-only',
          format: WHITE_DYE_FLUID_TEXTURE_FORMAT,
        },
      },
      {
        binding: 3,
        visibility: GPU_SHADER_STAGE_FLAGS.compute,
        sampler: { type: 'filtering' },
      },
      {
        binding: 4,
        visibility: GPU_SHADER_STAGE_FLAGS.compute,
        buffer: {
          type: 'uniform',
          minBindingSize: PARAM_BYTE_LENGTH,
        },
      },
      {
        binding: 5,
        visibility: GPU_SHADER_STAGE_FLAGS.compute,
        buffer: {
          type: 'read-only-storage',
        },
      },
    ],
  })
}

function createComputePipeline(
  device: GPUDevice,
  layout: GPUPipelineLayout,
  label: string,
  code: string,
): GPUComputePipeline {
  return device.createComputePipeline({
    label: `webgpu-fluid-${label}`,
    layout,
    compute: {
      module: device.createShaderModule({
        label: `webgpu-fluid-${label}-shader`,
        code,
      }),
      entryPoint: 'main',
    },
  })
}

function createTexturePair(device: GPUDevice, size: FluidResolution): TexturePair {
  return [createFluidTexture(device, size), createFluidTexture(device, size)]
}

function createFluidTexture(device: GPUDevice, size: FluidResolution): GPUTexture {
  return device.createTexture({
    size: [size.width, size.height, 1],
    format: WHITE_DYE_FLUID_TEXTURE_FORMAT,
    usage: GPU_TEXTURE_USAGE_FLAGS.textureBinding | GPU_TEXTURE_USAGE_FLAGS.storageBinding | GPU_TEXTURE_USAGE_FLAGS.copySrc,
  })
}

function getPairTexture(pair: TexturePair, index: number): GPUTexture {
  return pair[index === 0 ? 0 : 1]
}

function clampFinite(value: number, minValue: number, maxValue: number): number {
  if (!Number.isFinite(value)) return minValue
  return Math.min(Math.max(value, minValue), maxValue)
}

function clampInteger(value: number, minValue: number, maxValue: number): number {
  return Math.round(clampFinite(value, minValue, maxValue))
}

const COMPUTE_HEADER = `
struct FluidParams {
  simSize: vec4f,
  dyeSize: vec4f,
  time: vec4f,
  coefficients: vec4f,
  splat: vec4f,
  splatVelocity: vec4f,
  viewport: vec4f,
  obstacle: vec4f,
  obstacleOffset: vec4f,
}

@group(0) @binding(0) var sourceA: texture_2d<f32>;
@group(0) @binding(1) var sourceB: texture_2d<f32>;
@group(0) @binding(2) var targetTexture: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var linearSampler: sampler;
@group(0) @binding(4) var<uniform> params: FluidParams;
@group(0) @binding(5) var<storage, read> obstacleCells: array<u32>;

fn targetUv(id: vec3u) -> vec2f {
  let dims = vec2f(textureDimensions(targetTexture));
  return (vec2f(id.xy) + vec2f(0.5)) / dims;
}

fn clampToTexel(coord: vec2f, invSize: vec2f) -> vec2f {
  let halfTexel = invSize * 0.5;
  return clamp(coord, halfTexel, vec2f(1.0) - halfTexel);
}

fn maxVelocityClamp(velocity: vec2f) -> vec2f {
  let maxVelocity = params.time.w;
  return clamp(velocity, vec2f(-maxVelocity), vec2f(maxVelocity));
}

fn obstacleEnabled() -> bool {
  return params.obstacle.w > 0.5 &&
    params.obstacle.x > 0.0 &&
    params.obstacle.y >= 1.0 &&
    params.obstacle.z >= 1.0;
}

fn obstacleAtUv(uv: vec2f) -> bool {
  if (!obstacleEnabled()) {
    return false;
  }

  let cellSize = params.obstacle.x;
  let columns = params.obstacle.y;
  let rows = params.obstacle.z;
  let gridSize = vec2f(columns, rows) * cellSize;
  let pixel = uv * params.viewport.xy;
  let local = pixel - params.obstacleOffset.xy;

  if (local.x < 0.0 || local.y < 0.0 || local.x >= gridSize.x || local.y >= gridSize.y) {
    return false;
  }

  let cell = vec2u(floor(local / cellSize));
  let maskIndex = cell.y * u32(columns) + cell.x;
  return obstacleCells[maskIndex] != 0u;
}

fn sourceAVelocityBlocked(uv: vec2f) -> vec2f {
  if (obstacleAtUv(uv)) {
    return vec2f(0.0);
  }
  return textureSampleLevel(sourceA, linearSampler, uv, 0.0).xy;
}

fn sourceAScalarBlocked(uv: vec2f) -> f32 {
  if (obstacleAtUv(uv)) {
    return 0.0;
  }
  return textureSampleLevel(sourceA, linearSampler, uv, 0.0).x;
}

fn sourceBScalarBlocked(uv: vec2f) -> f32 {
  if (obstacleAtUv(uv)) {
    return 0.0;
  }
  return textureSampleLevel(sourceB, linearSampler, uv, 0.0).x;
}

fn sourceAPressureBoundary(uv: vec2f, centerPressure: f32) -> f32 {
  if (obstacleAtUv(uv)) {
    return centerPressure;
  }
  return textureSampleLevel(sourceA, linearSampler, uv, 0.0).x;
}

fn sourceBPressureBoundary(uv: vec2f, centerPressure: f32) -> f32 {
  if (obstacleAtUv(uv)) {
    return centerPressure;
  }
  return textureSampleLevel(sourceB, linearSampler, uv, 0.0).x;
}

fn storeValue(id: vec3u, value: vec4f) {
  textureStore(targetTexture, vec2i(id.xy), value);
}
`

const COMPUTE_MAIN_PREFIX = `
@compute @workgroup_size(${WHITE_DYE_FLUID_WORKGROUP_SIZE}, ${WHITE_DYE_FLUID_WORKGROUP_SIZE}, 1)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let dims = textureDimensions(targetTexture);
  if (id.x >= dims.x || id.y >= dims.y) {
    return;
  }
`

const VELOCITY_SPLAT_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let diff = uv - params.splat.xy;
  let scaled = vec2f(diff.x * params.splatVelocity.z, diff.y * params.splatVelocity.w);
  let distSq = dot(scaled, scaled);
  let radiusSq = max(params.splat.z * params.splat.z, 0.000001);
  let influence = exp(-distSq / radiusSq) * params.splat.w;
  let velocity = sourceAVelocityBlocked(uv);
  let updated = maxVelocityClamp(velocity + params.splatVelocity.xy * influence);
  storeValue(id, vec4f(updated, 0.0, 1.0));
}
`

const DYE_SPLAT_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let diff = uv - params.splat.xy;
  let scaled = vec2f(diff.x * params.splatVelocity.z, diff.y * params.splatVelocity.w);
  let distSq = dot(scaled, scaled);
  let radiusSq = max(params.splat.z * params.splat.z, 0.000001);
  let influence = exp(-distSq / radiusSq) * params.splat.w;
  let current = textureSampleLevel(sourceA, linearSampler, uv, 0.0).x;
  let density = clamp(current + influence, 0.0, 1.0);
  storeValue(id, vec4f(density, density, density, 1.0));
}
`

const VELOCITY_ADVECTION_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let velocity = sourceAVelocityBlocked(uv);
  let sampleUv = clampToTexel(uv - velocity * params.time.x * params.simSize.zw, params.simSize.zw);
  let sampled = sourceAVelocityBlocked(sampleUv);
  let decay = 1.0 / (1.0 + params.coefficients.x * params.time.x);
  let updated = maxVelocityClamp(sampled * decay);
  storeValue(id, vec4f(updated, 0.0, 1.0));
}
`

const DYE_ADVECTION_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let velocity = sourceAVelocityBlocked(uv);
  let sampleUv = clampToTexel(uv - velocity * params.time.x * params.simSize.zw, params.dyeSize.zw);
  var sampled = vec3f(0.0);
  if (!obstacleAtUv(sampleUv)) {
    sampled = textureSampleLevel(sourceB, linearSampler, sampleUv, 0.0).xyz;
  }
  let decay = 1.0 / (1.0 + params.coefficients.y * params.time.x);
  let density = clamp(sampled * decay, vec3f(0.0), vec3f(1.0));
  storeValue(id, vec4f(density, 1.0));
}
`

const CURL_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let texel = params.simSize.zw;
  let left = sourceAVelocityBlocked(vec2f(max(uv.x - texel.x, 0.0), uv.y));
  let right = sourceAVelocityBlocked(vec2f(min(uv.x + texel.x, 1.0), uv.y));
  let down = sourceAVelocityBlocked(vec2f(uv.x, max(uv.y - texel.y, 0.0)));
  let up = sourceAVelocityBlocked(vec2f(uv.x, min(uv.y + texel.y, 1.0)));
  let curl = right.y - left.y - (up.x - down.x);
  storeValue(id, vec4f(curl, 0.0, 0.0, 1.0));
}
`

const VORTICITY_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let texel = params.simSize.zw;
  let centerCurl = sourceBScalarBlocked(uv);
  let leftCurl = sourceBScalarBlocked(vec2f(max(uv.x - texel.x, 0.0), uv.y));
  let rightCurl = sourceBScalarBlocked(vec2f(min(uv.x + texel.x, 1.0), uv.y));
  let downCurl = sourceBScalarBlocked(vec2f(uv.x, max(uv.y - texel.y, 0.0)));
  let upCurl = sourceBScalarBlocked(vec2f(uv.x, min(uv.y + texel.y, 1.0)));
  let force = vec2f(abs(upCurl) - abs(downCurl), abs(rightCurl) - abs(leftCurl)) * 0.5;
  let normalized = force / max(length(force), 0.00001);
  let adjustedForce = vec2f(normalized.x, -normalized.y) * params.coefficients.z * centerCurl;
  let velocity = sourceAVelocityBlocked(uv);
  let updated = maxVelocityClamp(velocity + adjustedForce * params.time.x);
  storeValue(id, vec4f(updated, 0.0, 1.0));
}
`

const DIVERGENCE_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let texel = params.simSize.zw;
  let left = sourceAVelocityBlocked(vec2f(max(uv.x - texel.x, 0.0), uv.y));
  let right = sourceAVelocityBlocked(vec2f(min(uv.x + texel.x, 1.0), uv.y));
  let down = sourceAVelocityBlocked(vec2f(uv.x, max(uv.y - texel.y, 0.0)));
  let up = sourceAVelocityBlocked(vec2f(uv.x, min(uv.y + texel.y, 1.0)));
  let divergence = (right.x - left.x + up.y - down.y) * 0.5;
  storeValue(id, vec4f(divergence, 0.0, 0.0, 1.0));
}
`

const PRESSURE_CLEAR_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let pressure = textureSampleLevel(sourceA, linearSampler, uv, 0.0).x * params.time.z;
  storeValue(id, vec4f(pressure, 0.0, 0.0, 1.0));
}
`

const PRESSURE_JACOBI_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let texel = params.simSize.zw;
  let center = textureSampleLevel(sourceA, linearSampler, uv, 0.0).x;
  let left = sourceAPressureBoundary(vec2f(max(uv.x - texel.x, 0.0), uv.y), center);
  let right = sourceAPressureBoundary(vec2f(min(uv.x + texel.x, 1.0), uv.y), center);
  let down = sourceAPressureBoundary(vec2f(uv.x, max(uv.y - texel.y, 0.0)), center);
  let up = sourceAPressureBoundary(vec2f(uv.x, min(uv.y + texel.y, 1.0)), center);
  let divergence = sourceBScalarBlocked(uv);
  let pressure = (left + right + up + down - divergence) * 0.25;
  storeValue(id, vec4f(pressure, 0.0, 0.0, 1.0));
}
`

const GRADIENT_SUBTRACT_SHADER = `${COMPUTE_HEADER}
${COMPUTE_MAIN_PREFIX}
  let uv = targetUv(id);
  if (obstacleAtUv(uv)) {
    storeValue(id, vec4f(0.0, 0.0, 0.0, 1.0));
    return;
  }
  let texel = params.simSize.zw;
  let center = textureSampleLevel(sourceB, linearSampler, uv, 0.0).x;
  let leftUv = vec2f(max(uv.x - texel.x, 0.0), uv.y);
  let rightUv = vec2f(min(uv.x + texel.x, 1.0), uv.y);
  let downUv = vec2f(uv.x, max(uv.y - texel.y, 0.0));
  let upUv = vec2f(uv.x, min(uv.y + texel.y, 1.0));
  let left = sourceBPressureBoundary(leftUv, center);
  let right = sourceBPressureBoundary(rightUv, center);
  let down = sourceBPressureBoundary(downUv, center);
  let up = sourceBPressureBoundary(upUv, center);
  let gradient = vec2f(right - left, up - down) * 0.5;
  let velocity = sourceAVelocityBlocked(uv);
  var updated = maxVelocityClamp(velocity - gradient);
  if (obstacleAtUv(leftUv)) {
    updated.x = max(updated.x, 0.0);
  }
  if (obstacleAtUv(rightUv)) {
    updated.x = min(updated.x, 0.0);
  }
  if (obstacleAtUv(downUv)) {
    updated.y = max(updated.y, 0.0);
  }
  if (obstacleAtUv(upUv)) {
    updated.y = min(updated.y, 0.0);
  }
  storeValue(id, vec4f(updated, 0.0, 1.0));
}
`

const GRID_OVERLAY_SHADER = `
struct GridParams {
  viewport: vec4f,
  metrics: vec4f,
  offset: vec4f,
}

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) screenUv: vec2f,
}

@group(0) @binding(0) var<uniform> grid: GridParams;
@group(0) @binding(1) var<storage, read> activeCells: array<u32>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  let clip = positions[vertexIndex];
  var output: VertexOut;
  output.position = vec4f(clip, 0.0, 1.0);
  output.screenUv = vec2f(clip.x * 0.5 + 0.5, 0.5 - clip.y * 0.5);
  return output;
}

@fragment
fn fragmentMain(input: VertexOut) -> @location(0) vec4f {
  let cellSize = grid.metrics.x;
  let columns = grid.metrics.y;
  let rows = grid.metrics.z;
  let gridSize = vec2f(columns, rows) * cellSize;
  let pixel = input.screenUv * grid.viewport.xy;
  let local = pixel - grid.offset.xy;
  let inside = local.x >= 0.0 && local.y >= 0.0 && local.x < gridSize.x && local.y < gridSize.y;

  if (!inside || columns < 1.0 || rows < 1.0) {
    return vec4f(0.0);
  }

  let cell = local / cellSize;
  let cellIndex = vec2u(floor(cell));
  let maskIndex = cellIndex.y * u32(columns) + cellIndex.x;
  let isActive = activeCells[maskIndex] != 0u;
  let wrapped = fract(cell);
  let distanceToLine = min(
    min(wrapped.x, 1.0 - wrapped.x),
    min(wrapped.y, 1.0 - wrapped.y),
  ) * cellSize;
  let halfLineWidth = max(grid.metrics.w * 0.5, 0.125);
  let lineAlpha = (1.0 - smoothstep(halfLineWidth, halfLineWidth + 1.0, distanceToLine)) * grid.offset.z;
  let fillAlpha = select(0.0, 0.42, isActive);
  let alpha = fillAlpha + lineAlpha * (1.0 - fillAlpha);
  let color = (
    vec3f(1.0, 0.04, 0.02) * fillAlpha +
    vec3f(0.15, 0.82, 1.0) * lineAlpha * (1.0 - fillAlpha)
  ) / max(alpha, 0.0001);

  return vec4f(color, alpha);
}
`

const WHITE_DYE_RENDER_SHADER = `
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) sourceUv: vec2f,
}

@group(0) @binding(0) var dyeSampler: sampler;
@group(0) @binding(1) var dyeTexture: texture_2d<f32>;

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0),
  );
  let clip = positions[vertexIndex];
  var output: VertexOut;
  output.position = vec4f(clip, 0.0, 1.0);
  output.sourceUv = vec2f(clip.x * 0.5 + 0.5, 0.5 - clip.y * 0.5);
  return output;
}

@fragment
fn fragmentMain(input: VertexOut) -> @location(0) vec4f {
  let dye = textureSampleLevel(dyeTexture, dyeSampler, input.sourceUv, 0.0).x;
  let density = clamp(dye, 0.0, 1.0);
  return vec4f(vec3f(density), 1.0);
}
`
