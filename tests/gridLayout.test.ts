import { describe, expect, test } from 'bun:test'

import {
  GridSelection,
  beginGridPaint,
  createGridMask,
  paintGridCell,
  resolveGridCell,
  resolveGridCellSegment,
  resolveGridLayout,
} from '../src/gridLayout'

describe('resolveGridLayout', () => {
  test('fits only complete square cells and centers leftover margin', () => {
    expect(resolveGridLayout({ width: 103, height: 74 }, 20)).toEqual({
      cellSizePx: 20,
      columns: 5,
      rows: 3,
      width: 100,
      height: 60,
      marginX: 1.5,
      marginY: 7,
    })
  })

  test('clamps cell size so tiny or invalid values still produce a grid', () => {
    expect(resolveGridLayout({ width: 48, height: 32 }, 0)).toEqual({
      cellSizePx: 1,
      columns: 48,
      rows: 32,
      width: 48,
      height: 32,
      marginX: 0,
      marginY: 0,
    })
  })

  test('resolves pixel coordinates to cells inside the centered grid', () => {
    const layout = resolveGridLayout({ width: 103, height: 74 }, 20)

    expect(resolveGridCell(layout, { x: 1.49, y: 20 })).toBeNull()
    expect(resolveGridCell(layout, { x: 1.5, y: 7 })).toEqual({ column: 0, row: 0 })
    expect(resolveGridCell(layout, { x: 101.49, y: 66.99 })).toEqual({ column: 4, row: 2 })
    expect(resolveGridCell(layout, { x: 101.5, y: 67 })).toBeNull()
  })
})

describe('GridSelection painting', () => {
  test('paints cells on when the first clicked cell is off', () => {
    const selection = new GridSelection(4, 3)
    const paint = beginGridPaint(selection, { column: 1, row: 1 })

    paintGridCell(selection, paint, { column: 2, row: 1 })

    expect(selection.has({ column: 1, row: 1 })).toBe(true)
    expect(selection.has({ column: 2, row: 1 })).toBe(true)
  })

  test('paints cells off when the first clicked cell is on', () => {
    const selection = new GridSelection(4, 3)
    selection.set({ column: 1, row: 1 }, true)
    selection.set({ column: 2, row: 1 }, true)
    const paint = beginGridPaint(selection, { column: 1, row: 1 })

    paintGridCell(selection, paint, { column: 2, row: 1 })

    expect(selection.has({ column: 1, row: 1 })).toBe(false)
    expect(selection.has({ column: 2, row: 1 })).toBe(false)
  })

  test('resolves skipped cells along a drag segment', () => {
    expect(resolveGridCellSegment({ column: 0, row: 1 }, { column: 3, row: 1 })).toEqual([
      { column: 0, row: 1 },
      { column: 1, row: 1 },
      { column: 2, row: 1 },
      { column: 3, row: 1 },
    ])
  })
})

describe('createGridMask', () => {
  test('packages the current centered square grid and selected cells into a row-major mask', () => {
    const selection = new GridSelection(5, 3)
    selection.set({ column: 2, row: 1 }, true)

    const mask = createGridMask({ width: 103, height: 74 }, 20, selection)

    expect(mask.cellSizePx).toBe(20)
    expect(mask.columns).toBe(5)
    expect(mask.rows).toBe(3)
    expect(mask.marginX).toBe(1.5)
    expect(mask.marginY).toBe(7)
    expect(Array.from(mask.data)).toEqual([
      0, 0, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 0, 0,
    ])
    expect(mask.version).toBe(selection.version)
  })
})
