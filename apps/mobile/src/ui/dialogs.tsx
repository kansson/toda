import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import {
  clip,
  composeGeometry,
  fillMaxWidth,
  selectable,
  verticalScroll,
} from '@/lib/compose-modifiers'
import {
  AlertDialog,
  Box,
  Column,
  LinearProgressIndicator,
  ListItem,
  LoadingIndicator,
  RadioButton,
  Row,
  Text,
  TextButton,
  TextField,
  useMaterialColors,
  useNativeState,
} from '@/lib/compose-ui'

export type ChoiceDialogProps<T extends string | number> = {
  title: string
  options: { value: T; label: string }[]
  /** The choice made, or null while none is, as for something new. */
  selected: T | null
  onSelect: (value: T) => void
  onDismiss: () => void
}

/** A single choice from a short list, applied as soon as it is tapped. */
export function ChoiceDialog<T extends string | number>({
  title,
  options,
  selected,
  onSelect,
  onDismiss,
}: ChoiceDialogProps<T>) {
  const { t } = useLingui()
  const colors = useMaterialColors()

  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={{ typography: 'headlineSmall' }}>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column modifiers={[fillMaxWidth(), verticalScroll()]}>
          {options.map((option) => (
            <ListItem
              key={String(option.value)}
              colors={{ containerColor: colors.surfaceContainerHigh }}
              modifiers={[
                fillMaxWidth(),
                clip(composeGeometry.RoundedCorner(16)),
                selectable(option.value === selected, () => {
                  onSelect(option.value)
                  onDismiss()
                }),
              ]}
            >
              <ListItem.LeadingContent>
                <RadioButton selected={option.value === selected} />
              </ListItem.LeadingContent>
              <ListItem.HeadlineContent>
                <Text>{option.label}</Text>
              </ListItem.HeadlineContent>
            </ListItem>
          ))}
        </Column>
      </AlertDialog.Text>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text>{t({ message: 'Cancel', comment: 'Closes a dialog without changes' })}</Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  )
}

export type TextDialogProps = {
  title: string
  message?: string
  label: string
  initialValue: string
  confirmLabel: string
  /** At most this many characters. */
  maxLength?: number
  /** Allows an empty value, such as clearing a name back to its default. */
  allowEmpty?: boolean
  /** Characters typed upper case, for codes. */
  code?: boolean
  /** A web address, typed as it is: no capitals or corrections. */
  address?: boolean
  /** Starts at one line and grows to several, such as a task's details; Return starts a new line. */
  multiline?: boolean
  /** A whole number from 1 up to this, typed on the number pad, such as how often a task repeats. */
  number?: number
  onConfirm: (value: string) => void
  onDismiss: () => void
}

/** Asks for some text, such as a list's name, a task's details or how often it repeats. */
export function TextDialog({
  title,
  message,
  label,
  initialValue,
  confirmLabel,
  maxLength,
  allowEmpty = false,
  code = false,
  address = false,
  multiline = false,
  number,
  onConfirm,
  onDismiss,
}: TextDialogProps) {
  const { t } = useLingui()
  const text = useNativeState(initialValue)
  // The cursor starts after what is already there, to carry on typing.
  const selection = useNativeState({ start: initialValue.length, end: initialValue.length })
  const [value, setValue] = useState(initialValue)
  const amount = Number(value.trim())

  const valid =
    number === undefined
      ? allowEmpty || value.trim().length > 0
      : Number.isInteger(amount) && amount >= 1 && amount <= number

  function submit(next: string) {
    if (!valid) return
    onConfirm(next.trim())
    onDismiss()
  }

  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={{ typography: 'headlineSmall' }}>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 16 }}>
          {message ? <Text style={{ typography: 'bodyMedium' }}>{message}</Text> : null}
          <TextField
            value={text}
            selection={selection}
            singleLine={!multiline}
            maxLines={multiline ? 8 : 1}
            autoFocus
            maxLength={maxLength ?? (number === undefined ? undefined : String(number).length)}
            keyboardOptions={{
              autoCorrectEnabled: !code && !address && number === undefined,
              capitalization: code ? 'characters' : address ? 'none' : 'sentences',
              keyboardType:
                number !== undefined ? 'number' : address ? 'uri' : code ? 'ascii' : 'text',
              imeAction: multiline ? 'default' : 'done',
            }}
            keyboardActions={{ onDone: () => submit(value) }}
            onValueChange={setValue}
            modifiers={[fillMaxWidth()]}
          >
            <TextField.Label>
              <Text>{label}</Text>
            </TextField.Label>
          </TextField>
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton enabled={valid} onClick={() => submit(value)}>
          <Text>{confirmLabel}</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text>{t({ message: 'Cancel', comment: 'Closes a dialog without changes' })}</Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  )
}

export type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  dismissLabel?: string
  onConfirm: () => void
  onDismiss: () => void
}

/** Asks before something that cannot be taken back, such as deleting a list. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  dismissLabel,
  onConfirm,
  onDismiss,
}: ConfirmDialogProps) {
  const { t } = useLingui()

  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={{ typography: 'headlineSmall' }}>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Text>{message}</Text>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton
          onClick={() => {
            onConfirm()
            onDismiss()
          }}
        >
          <Text>{confirmLabel}</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text>
            {dismissLabel ?? t({ message: 'Cancel', comment: 'Closes a dialog without changes' })}
          </Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  )
}

/** Something under way or finished, such as an update downloading, with optional progress. */
export function StatusDialog({
  title,
  message,
  busy = false,
  progress = null,
  confirmLabel = null,
  dismissLabel,
  onConfirm,
  onDismiss,
}: {
  title: string
  message: string
  busy?: boolean
  /** How much is done, from 0 to 1. */
  progress?: number | null
  confirmLabel?: string | null
  dismissLabel: string
  onConfirm?: () => void
  onDismiss: () => void
}) {
  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={{ typography: 'headlineSmall' }}>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column verticalArrangement={{ spacedBy: 16 }}>
          {busy ? (
            <Row verticalAlignment='center' horizontalArrangement={{ spacedBy: 16 }}>
              <LoadingIndicator />
              <Text>{message}</Text>
            </Row>
          ) : (
            <Text>{message}</Text>
          )}
          {progress === null ? null : (
            <LinearProgressIndicator
              progress={Math.min(1, Math.max(0, progress))}
              modifiers={[fillMaxWidth()]}
            />
          )}
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        {confirmLabel && onConfirm ? (
          <TextButton onClick={onConfirm}>
            <Text>{confirmLabel}</Text>
          </TextButton>
        ) : (
          <Box />
        )}
      </AlertDialog.ConfirmButton>
      <AlertDialog.DismissButton>
        <TextButton onClick={onDismiss}>
          <Text>{dismissLabel}</Text>
        </TextButton>
      </AlertDialog.DismissButton>
    </AlertDialog>
  )
}
