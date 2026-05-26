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

export type GridBlockGroup = {
  readonly id: string
  readonly name: string
  readonly blockType: GridBlockType
  readonly color: string
}

export type GridBlockGroupCollection = {
  readonly groups: readonly GridBlockGroup[]
  readonly version: number
}

export type GridMask = GridLayout & {
  readonly data: Uint32Array
  readonly version: number
  readonly groupVersion: number
}

export type GridPaintAction = {
  readonly groupId: string | null
}

export const GRID_BLOCK_CODES = {
  solid: 1,
  emitter: 2,
  sink: 3,
} as const satisfies Record<GridBlockType, number>

export const DEFAULT_GRID_BLOCK_GROUPS: readonly GridBlockGroup[] = [
  { id: 'solid', name: 'Solid', blockType: 'solid', color: '#ff0a05' },
  { id: 'emitter', name: 'Emitter', blockType: 'emitter', color: '#2eff47' },
  { id: 'sink', name: 'Sink', blockType: 'sink', color: '#3452ff' },
]

export function encodeGridBlock(group: GridBlockGroup): number {
  const color = parseGridBlockColor(group.color)
  return (GRID_BLOCK_CODES[group.blockType] | (color.r << 8) | (color.g << 16) | (color.b << 24)) >>> 0
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

export function createGridMask(
  viewport: GridViewport,
  cellSizePx: number,
  selection: GridSelection,
  blockGroups: GridBlockGroupCollection,
): GridMask {
  const layout = resolveGridLayout(viewport, cellSizePx)
  const cellCount = layout.columns * layout.rows
  const data =
    selection.columns === layout.columns && selection.rows === layout.rows
      ? selection.toMaskWords(blockGroups.groups)
      : new Uint32Array(cellCount)

  return {
    ...layout,
    data,
    version: selection.version,
    groupVersion: blockGroups.version,
  }
}

export class GridSelection {
  private readonly cells = new Map<string, string>()
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

  get(cell: GridCell): string | null {
    return this.cells.get(this.key(cell)) ?? null
  }

  set(cell: GridCell, groupId: string | null): void {
    if (!this.contains(cell)) return

    const key = this.key(cell)
    const currentGroupId = this.cells.get(key) ?? null
    if (groupId === currentGroupId) return

    if (groupId) {
      this.cells.set(key, groupId)
    } else {
      this.cells.delete(key)
    }
    this.revision += 1
  }

  toMaskWords(blockGroups: readonly GridBlockGroup[]): Uint32Array {
    const groupWords = new Map(blockGroups.map((group) => [group.id, encodeGridBlock(group)]))
    const words = new Uint32Array(this.columns * this.rows)
    for (const [key, groupId] of this.cells) {
      const separator = key.indexOf(',')
      const column = Number(key.slice(0, separator))
      const row = Number(key.slice(separator + 1))
      if (Number.isInteger(column) && Number.isInteger(row) && this.contains({ column, row })) {
        words[row * this.columns + column] = groupWords.get(groupId) ?? 0
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
  groupId = DEFAULT_GRID_BLOCK_GROUPS[0].id,
): GridPaintAction {
  const action = { groupId: selection.get(cell) === groupId ? null : groupId }
  selection.set(cell, action.groupId)
  return action
}

export function paintGridCell(selection: GridSelection, action: GridPaintAction, cell: GridCell): void {
  selection.set(cell, action.groupId)
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

function parseGridBlockColor(color: string): { readonly r: number; readonly g: number; readonly b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(color)
  const hex = match?.[1] ?? 'ffffff'
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}
