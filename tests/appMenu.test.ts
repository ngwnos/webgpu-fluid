import { describe, expect, test } from 'bun:test'

import { VIEW_FLOATING_WINDOWS } from '../src/AppMenu'

describe('VIEW_FLOATING_WINDOWS', () => {
  test('lists Cell and Cursor as floating windows in the View menu', () => {
    expect(VIEW_FLOATING_WINDOWS.map((window) => window.title)).toEqual(['Cell', 'Cursor'])
  })
})
