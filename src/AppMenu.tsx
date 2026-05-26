import * as Menubar from '@radix-ui/react-menubar'
import { useEffect, useState } from 'react'

import {
  getCellPlacementMode,
  setCellPlacementMode,
  subscribeCellPlacementMode,
} from './cellPlacementMode'
import { CursorMovementGraph } from './CursorMovementGraph'
import { FloatingWindow } from './FloatingWindow'
import type { GridBlockType } from './gridLayout'

export const VIEW_FLOATING_WINDOWS = [
  { id: 'cell', title: 'Cell', defaultPosition: { x: 20, y: 56 } },
  { id: 'cursor', title: 'Cursor', defaultPosition: { x: 356, y: 56 } },
] as const

const CELL_PLACEMENT_MODES: readonly {
  readonly id: GridBlockType
  readonly label: string
}[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'emitter', label: 'Emitter' },
  { id: 'sink', label: 'Sink' },
]

export function AppMenu(): React.JSX.Element {
  const [cellWindowOpen, setCellWindowOpen] = useState(false)
  const [cursorWindowOpen, setCursorWindowOpen] = useState(false)
  const [activeCellPlacementMode, setActiveCellPlacementMode] = useState<GridBlockType>(() =>
    getCellPlacementMode(),
  )

  useEffect(() => subscribeCellPlacementMode(setActiveCellPlacementMode), [])

  const openViewWindow = (id: (typeof VIEW_FLOATING_WINDOWS)[number]['id']) => {
    if (id === 'cell') {
      setCellWindowOpen(true)
      return
    }
    setCursorWindowOpen(true)
  }

  return (
    <>
      <Menubar.Root className="app-menubar" aria-label="Fluid controls">
        <Menubar.Menu>
          <Menubar.Trigger className="app-menubar__trigger">View</Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content className="app-menubar__content" align="start" sideOffset={6}>
              {VIEW_FLOATING_WINDOWS.map((window) => (
                <Menubar.Item
                  className="app-menubar__item"
                  key={window.id}
                  onSelect={() => openViewWindow(window.id)}
                >
                  {window.title}
                </Menubar.Item>
              ))}
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>

        <Menubar.Menu>
          <Menubar.Trigger className="app-menubar__trigger">Simulation</Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content className="app-menubar__content" align="start" sideOffset={6}>
              <Menubar.Item className="app-menubar__item">Reset</Menubar.Item>
              <Menubar.Item className="app-menubar__item">Pause</Menubar.Item>
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>

        <Menubar.Menu>
          <Menubar.Trigger className="app-menubar__trigger">Grid</Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content className="app-menubar__content" align="start" sideOffset={6}>
              <Menubar.Item className="app-menubar__item">Cell size</Menubar.Item>
              <Menubar.Item className="app-menubar__item">Clear cells</Menubar.Item>
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>

        <Menubar.Menu>
          <Menubar.Trigger className="app-menubar__trigger">Audio</Menubar.Trigger>
          <Menubar.Portal>
            <Menubar.Content className="app-menubar__content" align="start" sideOffset={6}>
              <Menubar.Item className="app-menubar__item">Input</Menubar.Item>
              <Menubar.Item className="app-menubar__item">Reactive sources</Menubar.Item>
            </Menubar.Content>
          </Menubar.Portal>
        </Menubar.Menu>
      </Menubar.Root>

      <FloatingWindow
        title="Cell"
        open={cellWindowOpen}
        onOpenChange={setCellWindowOpen}
        defaultPosition={VIEW_FLOATING_WINDOWS[0].defaultPosition}
      >
        <div className="cell-window">
          <div className="cell-window__modes" role="group" aria-label="Cell placement mode">
            {CELL_PLACEMENT_MODES.map((mode) => (
              <button
                className="cell-window__mode"
                data-mode={mode.id}
                data-active={activeCellPlacementMode === mode.id}
                aria-pressed={activeCellPlacementMode === mode.id}
                key={mode.id}
                type="button"
                onClick={() => setCellPlacementMode(mode.id)}
              >
                <span className="cell-window__swatch" aria-hidden="true" />
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>
      </FloatingWindow>

      <FloatingWindow
        title="Cursor"
        open={cursorWindowOpen}
        onOpenChange={setCursorWindowOpen}
        defaultPosition={VIEW_FLOATING_WINDOWS[1].defaultPosition}
      >
        <div className="cursor-window">
          <CursorMovementGraph />
        </div>
      </FloatingWindow>
    </>
  )
}
