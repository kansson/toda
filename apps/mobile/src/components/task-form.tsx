import { useLingui } from '@lingui/react/macro'
import { useRef, useState } from 'react'
import {
  animateContentSize,
  clickable,
  clip,
  composeGeometry,
  fillMaxWidth,
  padding,
} from '@/lib/compose-modifiers'
import {
  Column,
  Icon,
  IconButton,
  ListItem,
  Text,
  TextField,
  type TextFieldRef,
  useMaterialColors,
  type useNativeState,
} from '@/lib/compose-ui'
import { useFeedback } from '@/lib/feedback'
import { NOTES_MAX, TITLE_MAX } from '@/tasks/model'
import { TextDialog } from '@/ui/dialogs'
import { type Glyph, glyphs } from '@/ui/glyphs'
import { cardCorners } from '@/ui/primitives'

/** A text field's value, held natively so typing never waits on JavaScript. */
type TextState = ReturnType<typeof useNativeState<string>>

/**
 * A new task's title, its one text field: Material's filled field with its label. The keyboard's
 * Done lets go of it without doing anything more.
 */
export function TitleField({
  title,
  onTitleChange,
}: {
  title: TextState
  onTitleChange?: (value: string) => void
}) {
  const { t } = useLingui()
  const field = useRef<TextFieldRef>(null)

  return (
    <TextField
      ref={field}
      value={title}
      maxLines={6}
      maxLength={TITLE_MAX}
      keyboardOptions={{ capitalization: 'sentences', autoCorrectEnabled: true, imeAction: 'done' }}
      keyboardActions={{ onDone: () => void field.current?.blur() }}
      onValueChange={onTitleChange}
      modifiers={[fillMaxWidth()]}
    >
      <TextField.Label>
        <Text>{t({ message: 'Title', comment: 'Label of a task’s title field' })}</Text>
      </TextField.Label>
    </TextField>
  )
}

/** A task's details as a field card's row, edited in a dialog of several lines. */
export function useDetailsRow(notes: string, onChange: (notes: string) => void) {
  const { t } = useLingui()
  const [editing, setEditing] = useState(false)

  const row: FieldCardRow = {
    key: 'details',
    glyph: 'notes',
    label: t({ message: 'Add details', comment: 'Task field: its details, unset' }),
    value: notes.trim() === '' ? null : notes.trim(),
    onPress: () => setEditing(true),
    clear: {
      label: t({ message: 'Remove details', comment: 'Clears a task’s details' }),
      onPress: () => onChange(''),
    },
  }

  const dialog = editing ? (
    <TextDialog
      title={t({ message: 'Details', comment: 'Dialog title: a task’s details' })}
      label={t({ message: 'Details', comment: 'Label of a task’s details field' })}
      initialValue={notes}
      maxLength={NOTES_MAX}
      multiline
      allowEmpty
      confirmLabel={t({ message: 'Save', comment: 'Saves a task’s details' })}
      onConfirm={onChange}
      onDismiss={() => setEditing(false)}
    />
  ) : null

  return { row, dialog }
}

/** Opens a task's list picker, or says in a snackbar that there are no lists to choose yet. */
export function useListPicker(hasLists: boolean, open: () => void) {
  const { t } = useLingui()
  const { showFeedback } = useFeedback()

  return () => {
    if (hasLists) open()
    else
      showFeedback(
        t({
          message: 'No lists yet. Add one from Lists on the main screen.',
          comment: 'Snackbar when choosing a task’s list while there are none',
        }),
      )
  }
}

export type FieldCardRow = {
  key: string
  glyph: Glyph
  /** What the row sets, shown dimmed while it is unset. */
  label: string
  value: string | null
  /** The value stands out in the error colour, such as a date that has passed. */
  urgent?: boolean
  onPress: () => void
  /** A trailing clear button for a set value. */
  clear?: { label: string; onPress: () => void }
}

/**
 * A task's settings as connected cards, as Settings has them: each its glyph and value, or its
 * name dimmed while unset, opening its picker when tapped.
 */
export function FieldCards({ rows }: { rows: FieldCardRow[] }) {
  const colors = useMaterialColors()

  return (
    <Column
      modifiers={[fillMaxWidth(), animateContentSize()]}
      verticalArrangement={{ spacedBy: 2 }}
    >
      {rows.map((row, index) => {
        const set = row.value !== null
        const content = row.urgent ? colors.error : set ? colors.onSurface : colors.onSurfaceVariant

        return (
          <ListItem
            // One key for good, so setting or clearing a value updates the row in place rather
            // than drawing it afresh.
            key={row.key}
            colors={{ containerColor: colors.surfaceContainerHigh }}
            modifiers={[
              fillMaxWidth(),
              clip(cardCorners(index, rows.length)),
              clickable(row.onPress),
            ]}
          >
            <ListItem.LeadingContent>
              <Icon
                source={glyphs[row.glyph]}
                size={24}
                tint={set ? content : colors.onSurfaceVariant}
              />
            </ListItem.LeadingContent>
            <ListItem.HeadlineContent>
              {/* All of it, such as every line of the details. */}
              <Text color={content}>{row.value ?? row.label}</Text>
            </ListItem.HeadlineContent>
            {/* The slot stays put and only the button comes and goes: a slot added to a drawn
                row never shows. */}
            <ListItem.TrailingContent>
              {set && row.clear ? (
                <IconButton onClick={row.clear.onPress}>
                  <Icon
                    source={glyphs.clear}
                    size={20}
                    tint={colors.onSurfaceVariant}
                    contentDescription={row.clear.label}
                  />
                </IconButton>
              ) : null}
            </ListItem.TrailingContent>
          </ListItem>
        )
      })}
    </Column>
  )
}

export type SubtaskItem = { key: string; title: string; done: boolean }

/**
 * A task's subtasks as connected cards under a Subtasks card whose + adds one in a dialog. Each
 * has its circle, to check it off where that applies, and a button to remove it.
 */
export function SubtaskCards({
  subtasks,
  onAdd,
  onToggle,
  onOpen,
  onRemove,
}: {
  subtasks: SubtaskItem[]
  onAdd: (title: string) => void
  /** Checks a subtask off or on; without it the circles only show. */
  onToggle?: (key: string) => void
  onOpen?: (key: string) => void
  onRemove: (key: string) => void
}) {
  const { t } = useLingui()
  const colors = useMaterialColors()
  const [adding, setAdding] = useState(false)
  const count = subtasks.length + 1

  return (
    <Column
      modifiers={[fillMaxWidth(), animateContentSize()]}
      verticalArrangement={{ spacedBy: 2 }}
    >
      <ListItem
        colors={{ containerColor: colors.surfaceContainerHigh }}
        modifiers={[fillMaxWidth(), clip(cardCorners(0, count)), clickable(() => setAdding(true))]}
      >
        <ListItem.LeadingContent>
          <Icon source={glyphs.addSubtask} size={24} tint={colors.onSurfaceVariant} />
        </ListItem.LeadingContent>
        <ListItem.HeadlineContent>
          <Text>{t({ message: 'Subtasks', comment: 'Task page heading over its subtasks' })}</Text>
        </ListItem.HeadlineContent>
        <ListItem.TrailingContent>
          <IconButton onClick={() => setAdding(true)}>
            <Icon
              source={glyphs.add}
              size={24}
              tint={colors.primary}
              contentDescription={t({ message: 'Add subtask', comment: 'Adds a subtask' })}
            />
          </IconButton>
        </ListItem.TrailingContent>
      </ListItem>
      {subtasks.map((subtask, index) => (
        <ListItem
          key={subtask.key}
          colors={{ containerColor: colors.surfaceContainerHigh }}
          modifiers={[
            fillMaxWidth(),
            clip(cardCorners(index + 1, count)),
            ...(onOpen ? [clickable(() => onOpen(subtask.key))] : []),
          ]}
        >
          <ListItem.LeadingContent>
            {/* A 24 dp leading icon, as the other cards have, so the rows line up. */}
            <Icon
              source={subtask.done ? glyphs.completed : glyphs.open}
              size={24}
              tint={subtask.done ? colors.primary : colors.onSurfaceVariant}
              modifiers={
                onToggle
                  ? [
                      clip(composeGeometry.RoundedCorner(12)),
                      clickable(() => onToggle(subtask.key)),
                    ]
                  : []
              }
            />
          </ListItem.LeadingContent>
          <ListItem.HeadlineContent>
            <Text color={subtask.done ? colors.onSurfaceVariant : colors.onSurface}>
              {subtask.title ||
                t({ message: '(No title)', comment: 'Shown for a task without a title' })}
            </Text>
          </ListItem.HeadlineContent>
          <ListItem.TrailingContent>
            <IconButton onClick={() => onRemove(subtask.key)}>
              <Icon
                source={glyphs.clear}
                size={20}
                tint={colors.onSurfaceVariant}
                contentDescription={t({ message: 'Delete subtask', comment: 'Removes a subtask' })}
              />
            </IconButton>
          </ListItem.TrailingContent>
        </ListItem>
      ))}
      {adding ? (
        <TextDialog
          title={t({ message: 'Add subtask', comment: 'Dialog title' })}
          label={t({ message: 'Title', comment: 'Field label: a subtask’s title' })}
          initialValue=''
          maxLength={TITLE_MAX}
          confirmLabel={t({ message: 'Add', comment: 'Adds the subtask' })}
          onConfirm={(value) => {
            if (value.trim() !== '') onAdd(value.trim())
          }}
          onDismiss={() => setAdding(false)}
        />
      ) : null}
    </Column>
  )
}

/**
 * A task page's body: the cards in a scrolling column, with as much room above the first as
 * between them, and room at the end for the floating button.
 */
export const formPadding = padding(16, 16, 16, 96)
