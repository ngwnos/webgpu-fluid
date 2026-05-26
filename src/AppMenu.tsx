import * as Menubar from '@radix-ui/react-menubar'
import { useState } from 'react'

import { FloatingWindow } from './FloatingWindow'

export const VIEW_FLOATING_WINDOWS = [
  { id: 'cell', title: 'Cell', defaultPosition: { x: 20, y: 56 } },
  { id: 'cursor', title: 'Cursor', defaultPosition: { x: 356, y: 56 } },
] as const

export function AppMenu(): React.JSX.Element {
  const [cellWindowOpen, setCellWindowOpen] = useState(false)
  const [cursorWindowOpen, setCursorWindowOpen] = useState(false)

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
          <label className="cell-window__field">
            <span>Cell size</span>
            <input type="range" min="16" max="96" defaultValue="40" />
          </label>
          <label className="cell-window__field">
            <span>Paint mode</span>
            <select defaultValue="toggle">
              <option value="toggle">Toggle</option>
              <option value="on">Paint on</option>
              <option value="off">Paint off</option>
            </select>
          </label>
          <label className="cell-window__check">
            <input type="checkbox" defaultChecked />
            <span>Show grid lines</span>
          </label>
          <button className="cell-window__action" type="button">
            Clear active cells
          </button>
        </div>
      </FloatingWindow>

      <FloatingWindow
        title="Cursor"
        open={cursorWindowOpen}
        onOpenChange={setCursorWindowOpen}
        defaultPosition={VIEW_FLOATING_WINDOWS[1].defaultPosition}
      >
        <div className="cursor-window" />
      </FloatingWindow>
    </>
  )
}
