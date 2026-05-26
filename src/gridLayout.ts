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

export type GridPoint = {
  readonly x: number
  readonly y: number
}

export type GridCell = {
  readonly column: number
  readonly row: number
}

export type GridBlockType = 'solid' | 'emitter' | 'sink'

export type GridMask = GridLayout & {
  readonly data: Uint32Array
  readonly version: number
}

export type GridPaintAction = {
  readonly block: GridBlockType | null
}

export const GRID_BLOCK_CODES = {
  solid: 1,
  emitter: 2,
  sink: 3,
} as const satisfies Record<GridBlockType, number>

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

export function resolveGridCell(layout: GridLayout, point: GridPoint): GridCell | null {
  if (layout.columns <= 0 || layout.rows <= 0) return null

  const localX = point.x - layout.marginX
  const localY = point.y - layout.marginY
  if (localX < 0 || localY < 0 || localX >= layout.width || localY >= layout.height) return null

  const column = Math.floor(localX / layout.cellSizePx)
  const row = Math.floor(localY / layout.cellSizePx)
  if (column < 0 || row < 0 || column >= layout.columns || row >= layout.rows) return null

  return { column, row }
}

export function createGridMask(viewport: GridViewport, cellSizePx: number, selection: GridSelection): GridMask {
  const layout = resolveGridLayout(viewport, cellSizePx)
  const cellCount = layout.columns * layout.rows
  const data =
    selection.columns === layout.columns && selection.rows === layout.rows
      ? selection.toMaskWords()
      : new Uint32Array(cellCount)

  return {
    ...layout,
    data,
    version: selection.version,
  }
}

export class GridSelection {
  private readonly cells = new Map<string, GridBlockType>()
  private revision = 0

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {}

  get version(): number {
    return this.revision
  }

  has(cell: GridCell): boolean {
    return this.get(cell) !== null
  }

  get(cell: GridCell): GridBlockType | null {
    return this.cells.get(this.key(cell)) ?? null
  }

  set(cell: GridCell, block: GridBlockType | null): void {
    if (!this.contains(cell)) return

    const key = this.key(cell)
    const currentBlock = this.cells.get(key) ?? null
    if (block === currentBlock) return

    if (block) {
      this.cells.set(key, block)
    } else {
      this.cells.delete(key)
    }
    this.revision += 1
  }

  toMaskWords(): Uint32Array {
    const words = new Uint32Array(this.columns * this.rows)
    for (const [key, block] of this.cells) {
      const separator = key.indexOf(',')
      const column = Number(key.slice(0, separator))
      const row = Number(key.slice(separator + 1))
      if (Number.isInteger(column) && Number.isInteger(row) && this.contains({ column, row })) {
        words[row * this.columns + column] = GRID_BLOCK_CODES[block]
      }
    }
    return words
  }

  private contains(cell: GridCell): boolean {
    return cell.column >= 0 && cell.row >= 0 && cell.column < this.columns && cell.row < this.rows
  }

  private key(cell: GridCell): string {
    return `${cell.column},${cell.row}`
  }
}

export function beginGridPaint(
  selection: GridSelection,
  cell: GridCell,
  block: GridBlockType = 'solid',
): GridPaintAction {
  const action = { block: selection.get(cell) === block ? null : block }
  selection.set(cell, action.block)
  return action
}

export function paintGridCell(selection: GridSelection, action: GridPaintAction, cell: GridCell): void {
  selection.set(cell, action.block)
}

export function resolveGridCellSegment(start: GridCell, end: GridCell): GridCell[] {
  const cells: GridCell[] = []
  let column = start.column
  let row = start.row
  const deltaColumn = Math.abs(end.column - start.column)
  const deltaRow = -Math.abs(end.row - start.row)
  const stepColumn = start.column < end.column ? 1 : -1
  const stepRow = start.row < end.row ? 1 : -1
  let error = deltaColumn + deltaRow

  while (true) {
    cells.push({ column, row })
    if (column === end.column && row === end.row) break

    const nextError = error * 2
    if (nextError >= deltaRow) {
      error += deltaRow
      column += stepColumn
    }
    if (nextError <= deltaColumn) {
      error += deltaColumn
      row += stepRow
    }
  }

  return cells
}
