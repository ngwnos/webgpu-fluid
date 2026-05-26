import { describe, expect, test } from 'bun:test'

import { resolveGridLayout } from '../src/gridLayout'

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
})
