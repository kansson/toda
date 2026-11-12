import { useLingui } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'
import {
  clickable,
  clip,
  composeGeometry,
  fillMaxWidth,
  selectable,
  verticalScroll,
} from '@/lib/compose-modifiers'
import {
  AlertDialog,
  Checkbox,
  Column,
  Icon,
  IconButton,
  ListItem,
  Text,
  TextButton,
  useMaterialColors,
} from '@/lib/compose-ui'
import { type Glyph, glyphs } from '@/ui/glyphs'
import { cardCorners } from '@/ui/primitives'

/**
 * One of the editor's connected cards, as a task's field cards are: its glyph and value, or what
 * it sets dimmed while unset, with a button to clear a set value; or a control of its own.
 */
export function SettingCard({
  glyph,
  label,
  value,
  headline,
  index,
  count,
  trailing,
  clear,
  onPress,
}: {
  glyph: Glyph
  label: string
  /** The value, or null while unset; a card without one shows its label as it is. */
  value?: string | null
  /** In place of the label, such as a row of weekdays. */
  headline?: ReactNode
  index: number
  count: number
  trailing?: ReactNode
  clear?: { label: string; onPress: () => void }
  onPress?: () => void
}) {
  const colors = useMaterialColors()
  const unset = value === null
  const content = unset ? colors.onSurfaceVariant : colors.onSurface

  return (
    <ListItem
      colors={{ containerColor: colors.surfaceContainerHigh }}
      modifiers={[
        fillMaxWidth(),
        clip(cardCorners(index, count)),
        ...(onPress ? [clickable(onPress)] : []),
      ]}
    >
      <ListItem.LeadingContent>
        <Icon source={glyphs[glyph]} size={24} tint={unset ? colors.onSurfaceVariant : content} />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        {headline ?? (
          <Text color={content} maxLines={2} overflow='ellipsis'>
            {value ?? label}
          </Text>
        )}
      </ListItem.HeadlineContent>
      {/* The slot stays put and only its content changes: a slot added later never shows. */}
      <ListItem.TrailingContent>
        {trailing ??
          (clear && !unset ? (
            <IconButton onClick={clear.onPress}>
              <Icon
                source={glyphs.clear}
                size={20}
                tint={colors.onSurfaceVariant}
                contentDescription={clear.label}
              />
            </IconButton>
          ) : null)}
      </ListItem.TrailingContent>
    </ListItem>
  )
}

/**
 * Several of a few choices, ticked in a list. At least one must be ticked unless `allowNone`;
 * `allowAll: false` keeps one unticked.
 */
export function ChecklistDialog({
  title,
  options,
  chosen: initial,
  allowNone = false,
  allowAll = true,
  onConfirm,
  onDismiss,
}: {
  title: string
  options: { value: number; label: string }[]
  chosen: number[]
  allowNone?: boolean
  allowAll?: boolean
  onConfirm: (chosen: number[]) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const colors = useMaterialColors()
  const [chosen, setChosen] = useState(initial)

  const toggle = (value: number) =>
    setChosen((current) =>
      current.includes(value) ? current.filter((other) => other !== value) : [...current, value],
    )

  return (
    <AlertDialog onDismissRequest={onDismiss}>
      <AlertDialog.Title>
        <Text style={{ typography: 'headlineSmall' }}>{title}</Text>
      </AlertDialog.Title>
      <AlertDialog.Text>
        <Column modifiers={[fillMaxWidth(), verticalScroll()]}>
          {options.map((option) => (
            <ListItem
              key={option.value}
              colors={{ containerColor: colors.surfaceContainerHigh }}
              modifiers={[
                fillMaxWidth(),
                clip(composeGeometry.RoundedCorner(16)),
                selectable(chosen.includes(option.value), () => toggle(option.value), 'checkbox'),
              ]}
            >
              <ListItem.LeadingContent>
                <Checkbox value={chosen.includes(option.value)} />
              </ListItem.LeadingContent>
              <ListItem.HeadlineContent>
                <Text>{option.label}</Text>
              </ListItem.HeadlineContent>
            </ListItem>
          ))}
        </Column>
      </AlertDialog.Text>
      <AlertDialog.ConfirmButton>
        <TextButton
          enabled={(allowNone || chosen.length > 0) && (allowAll || chosen.length < options.length)}
          onClick={() => {
            onConfirm(chosen.slice().sort((a, b) => a - b))
            onDismiss()
          }}
        >
          <Text>{t({ message: 'OK', comment: 'Confirms a dialog' })}</Text>
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
