import { useLingui } from '@lingui/react/macro'
import { useState } from 'react'
import { useActions } from '@/data/provider'
import { useLists } from '@/data/queries'
import { clickable, clip, fillMaxWidth, height } from '@/lib/compose-modifiers'
import {
  Box,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  ListItem,
  Row,
  Text,
  useMaterialColors,
} from '@/lib/compose-ui'
import { useFeedback } from '@/lib/feedback'
import type { List } from '@/tasks/model'
import { ConfirmDialog, TextDialog } from '@/ui/dialogs'
import { glyphs } from '@/ui/glyphs'
import { cardCorners, Empty } from '@/ui/primitives'
import { Action } from '@/ui/screen'
import { Sheet } from '@/ui/sheets'
import { ReorderList } from '../../modules/ui'

/** How tall one list's card is, for bounding the lazy list inside the sheet. */
const ROW_HEIGHT = 58

/** The sheet's least height under its title, the empty state's, so it never opens as a sliver. */
const MIN_HEIGHT = 220

type Dialog = { kind: 'new' } | { kind: 'rename'; list: List } | { kind: 'delete'; list: List }

/** One list as a card: tapped to show it, held to drag it, and its menu to rename or delete it. */
function ListCard({
  list,
  index,
  count,
  chosen,
  onChoose,
  onRename,
  onDelete,
}: {
  list: List
  index: number
  count: number
  chosen: boolean
  onChoose: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const { t } = useLingui()
  const colors = useMaterialColors()
  const [open, setOpen] = useState(false)

  return (
    <ListItem
      colors={{ containerColor: colors.surfaceContainerHigh }}
      modifiers={[fillMaxWidth(), clip(cardCorners(index, count)), clickable(onChoose)]}
    >
      <ListItem.HeadlineContent>
        <Text maxLines={1} overflow='ellipsis'>
          {list.title}
        </Text>
      </ListItem.HeadlineContent>
      <ListItem.TrailingContent>
        <Row verticalAlignment='center'>
          {chosen ? <Icon source={glyphs.check} size={24} tint={colors.primary} /> : null}
          <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
            <DropdownMenu.Trigger>
              <Action
                glyph='more'
                label={t({
                  message: `Options for ${list.title}`,
                  comment: 'Lists sheet: button opening one list’s menu',
                })}
                onPress={() => setOpen(true)}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Items>
              <DropdownMenuItem
                onClick={() => {
                  setOpen(false)
                  onRename()
                }}
              >
                <DropdownMenuItem.LeadingIcon>
                  <Icon source={glyphs.edit} size={24} />
                </DropdownMenuItem.LeadingIcon>
                <DropdownMenuItem.Text>
                  <Text>{t({ message: 'Rename', comment: 'List menu command' })}</Text>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setOpen(false)
                  onDelete()
                }}
              >
                <DropdownMenuItem.LeadingIcon>
                  <Icon source={glyphs.delete} size={24} />
                </DropdownMenuItem.LeadingIcon>
                <DropdownMenuItem.Text>
                  <Text>{t({ message: 'Delete', comment: 'List menu command' })}</Text>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            </DropdownMenu.Items>
          </DropdownMenu>
        </Row>
      </ListItem.TrailingContent>
    </ListItem>
  )
}

/**
 * Chooses which lists the main screen shows, or every list, and keeps the lists: one card per
 * list, ticked on and off with the sheet staying open, held and dragged into a new order, each
 * with a menu to rename or delete it. Its app bar closes it, adds a list and goes back to every
 * list.
 */
export function ListsSheet({
  scope,
  onChoose,
  onDismiss,
}: {
  /** The lists shown, by id; none shows every list. */
  scope: readonly string[]
  onChoose: (scope: string[]) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const actions = useActions()
  const lists = useLists()
  const { showFeedback } = useFeedback()
  const [dialog, setDialog] = useState<Dialog | null>(null)

  return (
    <>
      <Sheet
        tall={lists.length > 6}
        title={t({ message: 'Lists', comment: 'Title of the sheet choosing the list shown' })}
        action={() => (
          <Row verticalAlignment='center'>
            <Action
              glyph='add'
              label={t({ message: 'New list', comment: 'Lists sheet button adding a list' })}
              onPress={() => setDialog({ kind: 'new' })}
            />
            <Action
              glyph='clearFilters'
              label={t({
                message: 'Show every list',
                comment: 'Lists sheet button going back to every list',
              })}
              enabled={scope.length > 0}
              onPress={() => onChoose([])}
            />
          </Row>
        )}
        onDismiss={onDismiss}
      >
        {() =>
          lists.length === 0 ? (
            <Empty
              glyph='list'
              title={t({ message: 'No lists yet', comment: 'Lists sheet with no lists' })}
              height={MIN_HEIGHT}
            />
          ) : (
            // Bounded, as a lazy list inside a sheet must be.
            <Box
              modifiers={[
                fillMaxWidth(),
                height(Math.max(MIN_HEIGHT, Math.min(lists.length * (ROW_HEIGHT + 2) + 24, 600))),
              ]}
            >
              <ReorderList
                keys={lists.map((list) => list.clientId)}
                draggable={lists.map(() => true)}
                spacing={2}
                contentPadding={{ start: 16, end: 16, bottom: 24 }}
                onReorder={(key, order) => actions.reorderLists(order, key)}
              >
                {lists.map((list, index) => (
                  <ListCard
                    key={list.clientId}
                    list={list}
                    index={index}
                    count={lists.length}
                    chosen={scope.includes(list.clientId)}
                    // Ticked on and off, the sheet staying open to choose more.
                    onChoose={() =>
                      onChoose(
                        scope.includes(list.clientId)
                          ? scope.filter((id) => id !== list.clientId)
                          : [...scope, list.clientId],
                      )
                    }
                    onRename={() => setDialog({ kind: 'rename', list })}
                    onDelete={() => setDialog({ kind: 'delete', list })}
                  />
                ))}
              </ReorderList>
            </Box>
          )
        }
      </Sheet>
      {dialog?.kind === 'new' ? (
        <TextDialog
          title={t({ message: 'New list', comment: 'Dialog title' })}
          label={t({ message: 'Name', comment: 'Field label: a list’s name' })}
          initialValue=''
          maxLength={1023}
          confirmLabel={t({ message: 'Create', comment: 'Creates the list' })}
          onConfirm={(title) => actions.createList(title)}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'rename' ? (
        <TextDialog
          title={t({ message: 'Rename list', comment: 'Dialog title' })}
          label={t({ message: 'Name', comment: 'Field label: a list’s name' })}
          initialValue={dialog.list.title}
          maxLength={1023}
          confirmLabel={t({ message: 'Save', comment: 'Saves a list’s new name' })}
          onConfirm={(title) => actions.renameList(dialog.list.clientId, title)}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDialog
          title={t({ message: 'Delete this list?', comment: 'Dialog title' })}
          message={t({
            message: 'All tasks in this list will be deleted for good.',
            comment: 'Delete list warning',
          })}
          confirmLabel={t({ message: 'Delete', comment: 'Confirms deleting a list' })}
          onConfirm={() => {
            actions.deleteList(dialog.list.clientId)

            if (scope.includes(dialog.list.clientId))
              onChoose(scope.filter((id) => id !== dialog.list.clientId))
            showFeedback(t({ message: 'List deleted', comment: 'Snackbar after deleting a list' }))
          }}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
    </>
  )
}
