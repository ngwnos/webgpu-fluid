import * as Dialog from '@radix-ui/react-dialog'
import { type ReactNode, useState } from 'react'

export type ConfirmActionButtonProps = {
  readonly children: ReactNode
  readonly title: string
  readonly description: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly disabled?: boolean
  readonly className?: string
  readonly onConfirm: () => void
}

export function ConfirmActionButton({
  children,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  disabled = false,
  className,
  onConfirm,
}: ConfirmActionButtonProps): React.JSX.Element {
  const [open, setOpen] = useState(false)

  const confirm = () => {
    onConfirm()
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className={className} type="button" disabled={disabled}>
          {children}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="confirm-dialog__overlay" />
        <Dialog.Content className="confirm-dialog" onOpenAutoFocus={(event) => event.preventDefault()}>
          <Dialog.Title className="confirm-dialog__title">{title}</Dialog.Title>
          <Dialog.Description className="confirm-dialog__description">{description}</Dialog.Description>
          <div className="confirm-dialog__actions">
            <Dialog.Close asChild>
              <button className="confirm-dialog__button" type="button">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button className="confirm-dialog__button confirm-dialog__button--danger" type="button" onClick={confirm}>
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
