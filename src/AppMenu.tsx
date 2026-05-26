import * as Menubar from '@radix-ui/react-menubar'
import { useEffect, useState } from 'react'

import {
  addBlockGroup,
  deleteBlockGroup,
  getBlockGroupsState,
  setActiveBlockGroupId,
  subscribeBlockGroups,
  updateBlockGroup,
  type BlockGroupsState,
} from './blockGroups'
import { ConfirmActionButton } from './ConfirmActionButton'
import { CurveEditor } from './CurveEditor'
import { CursorMovementGraph } from './CursorMovementGraph'
import { FloatingWindow } from './FloatingWindow'
import type { GridBlockType } from './gridLayout'

export const VIEW_FLOATING_WINDOWS = [
  { id: 'cell', title: 'Cell', defaultPosition: { x: 20, y: 56 } },
  { id: 'cursor', title: 'Cursor', defaultPosition: { x: 356, y: 56 } },
  { id: 'curve', title: 'Curve Editor', defaultPosition: { x: 300, y: 96 } },
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
  const [curveWindowOpen, setCurveWindowOpen] = useState(false)
  const [blockGroupsState, setBlockGroupsState] = useState<BlockGroupsState>(() => getBlockGroupsState())

  useEffect(() => subscribeBlockGroups(setBlockGroupsState), [])

  const openViewWindow = (id: (typeof VIEW_FLOATING_WINDOWS)[number]['id']) => {
    if (id === 'cell') {
      setCellWindowOpen(true)
      return
    }
    if (id === 'cursor') {
      setCursorWindowOpen(true)
      return
    }
    setCurveWindowOpen(true)
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
          <button className="cell-window__add-group" type="button" onClick={() => addBlockGroup()}>
            Add Group
          </button>
          <div className="cell-window__groups" role="list" aria-label="Block groups">
            {blockGroupsState.groups.map((group) => (
              <section
                className="cell-group"
                data-active={blockGroupsState.activeGroupId === group.id}
                key={group.id}
              >
                <button
                  className="cell-group__summary"
                  type="button"
                  aria-expanded={blockGroupsState.activeGroupId === group.id}
                  onClick={() => setActiveBlockGroupId(group.id)}
                >
                  <span className="cell-group__swatch" style={{ backgroundColor: group.color }} aria-hidden="true" />
                  <span className="cell-group__summary-text">
                    <span className="cell-group__name">{group.name}</span>
                    <span className="cell-group__type">{group.blockType}</span>
                  </span>
                </button>

                {blockGroupsState.activeGroupId === group.id ? (
                  <div className="cell-group__settings">
                    <label className="cell-group__field">
                      <span>Name</span>
                      <input
                        type="text"
                        value={group.name}
                        onChange={(event) => updateBlockGroup(group.id, { name: event.currentTarget.value })}
                      />
                    </label>
                    <label className="cell-group__field">
                      <span>Type</span>
                      <select
                        value={group.blockType}
                        onChange={(event) =>
                          updateBlockGroup(group.id, { blockType: event.currentTarget.value as GridBlockType })
                        }
                      >
                        {CELL_PLACEMENT_MODES.map((mode) => (
                          <option key={mode.id} value={mode.id}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cell-group__field cell-group__field--color">
                      <span>Color</span>
                      <input
                        type="color"
                        value={group.color}
                        onChange={(event) => updateBlockGroup(group.id, { color: event.currentTarget.value })}
                      />
                    </label>
                    <ConfirmActionButton
                      className="cell-group__delete"
                      title={`Delete ${group.name}?`}
                      description="Blocks placed with this group will be removed from the simulation."
                      confirmLabel="Delete"
                      disabled={blockGroupsState.groups.length <= 1}
                      onConfirm={() => deleteBlockGroup(group.id)}
                    >
                      Delete Group
                    </ConfirmActionButton>
                  </div>
                ) : null}
              </section>
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

      <FloatingWindow
        title="Curve Editor"
        open={curveWindowOpen}
        onOpenChange={setCurveWindowOpen}
        defaultPosition={VIEW_FLOATING_WINDOWS[2].defaultPosition}
        className="floating-window--curve"
      >
        <CurveEditor />
      </FloatingWindow>
    </>
  )
}
