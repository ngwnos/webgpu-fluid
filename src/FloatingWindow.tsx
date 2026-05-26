import * as Collapsible from '@radix-ui/react-collapsible'
import * as Dialog from '@radix-ui/react-dialog'
import { type ReactNode, useRef, useState } from 'react'

import {
  resolveDraggedWindowPosition,
  type Point,
  type Size,
} from './floatingWindowModel'

export type FloatingWindowProps = {
  readonly title: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly defaultPosition?: Point
  readonly defaultCollapsed?: boolean
  readonly className?: string
  readonly children: ReactNode
}

type DragState = {
  readonly originPointer: Point
  readonly originPosition: Point
}

export function FloatingWindow({
  title,
  open,
  onOpenChange,
  defaultPosition = { x: 24, y: 56 },
  defaultCollapsed = false,
  className,
  children,
}: FloatingWindowProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [position, setPosition] = useState(defaultPosition)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<DragState | null>(null)

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return

    event.currentTarget.setPointerCapture(event.pointerId)
    dragState.current = {
      originPointer: { x: event.clientX, y: event.clientY },
      originPosition: position,
    }
  }

  const continueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return

    const rect = contentRef.current?.getBoundingClientRect()
    const size: Size = {
      width: rect?.width ?? 280,
      height: rect?.height ?? 180,
    }

    setPosition(
      resolveDraggedWindowPosition({
        ...dragState.current,
        pointer: { x: event.clientX, y: event.clientY },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        windowSize: size,
      }),
    )
  }

  const endDrag = () => {
    dragState.current = null
  }

  return (
    <Dialog.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Content
          ref={contentRef}
          className={['floating-window', className].filter(Boolean).join(' ')}
          style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          aria-describedby={undefined}
        >
          <Collapsible.Root open={!collapsed} onOpenChange={(nextOpen) => setCollapsed(!nextOpen)}>
            <div
              className="floating-window__header"
              onPointerDown={beginDrag}
              onPointerMove={continueDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <Dialog.Title className="floating-window__title">{title}</Dialog.Title>
              <div className="floating-window__controls">
                <Collapsible.Trigger asChild>
                  <button
                    className="floating-window__button"
                    type="button"
                    aria-label={collapsed ? 'Expand window' : 'Collapse window'}
                  >
                    {collapsed ? '+' : '-'}
                  </button>
                </Collapsible.Trigger>
                <Dialog.Close asChild>
                  <button className="floating-window__button" type="button" aria-label="Close window">
                    x
                  </button>
                </Dialog.Close>
              </div>
            </div>
            <Collapsible.Content className="floating-window__body">{children}</Collapsible.Content>
          </Collapsible.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function isInteractiveTarget(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest('button, input, select, textarea, a'))
}
