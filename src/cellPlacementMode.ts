import type { GridBlockType } from './gridLayout'

type CellPlacementModeListener = (mode: GridBlockType) => void

let currentCellPlacementMode: GridBlockType = 'solid'
const listeners = new Set<CellPlacementModeListener>()

export function getCellPlacementMode(): GridBlockType {
  return currentCellPlacementMode
}

export function setCellPlacementMode(mode: GridBlockType): void {
  if (mode === currentCellPlacementMode) return

  currentCellPlacementMode = mode
  for (const listener of listeners) {
    listener(mode)
  }
}

export function subscribeCellPlacementMode(listener: CellPlacementModeListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
