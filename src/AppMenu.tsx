import * as Menubar from '@radix-ui/react-menubar'

export function AppMenu(): React.JSX.Element {
  return (
    <Menubar.Root className="app-menubar" aria-label="Fluid controls">
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
  )
}
