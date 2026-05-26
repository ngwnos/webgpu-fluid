export type GridViewport = {
  readonly width: number
  readonly height: number
}

export type GridLayout = {
  readonly cellSizePx: number
  readonly columns: number
  readonly rows: number
  readonly width: number
  readonly height: number
  readonly marginX: number
  readonly marginY: number
}

export function resolveGridLayout(viewport: GridViewport, cellSizePx: number): GridLayout {
  const width = Math.max(1, Math.round(viewport.width))
  const height = Math.max(1, Math.round(viewport.height))
  const resolvedCellSize = Math.max(1, Math.round(Number.isFinite(cellSizePx) ? cellSizePx : 1))
  const columns = Math.floor(width / resolvedCellSize)
  const rows = Math.floor(height / resolvedCellSize)
  const gridWidth = columns * resolvedCellSize
  const gridHeight = rows * resolvedCellSize

  return {
    cellSizePx: resolvedCellSize,
    columns,
    rows,
    width: gridWidth,
    height: gridHeight,
    marginX: (width - gridWidth) / 2,
    marginY: (height - gridHeight) / 2,
  }
}
