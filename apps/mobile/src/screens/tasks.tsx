import { useLingui } from '@lingui/react/macro'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useDeferredValue, useState } from 'react'
import { ListsSheet } from '@/components/lists-sheet'
import { SearchField } from '@/components/search-field'
import { TaskList } from '@/components/task-list'
import { useActions } from '@/data/provider'
import { useLists } from '@/data/queries'
import { fillMaxWidth, padding, weight } from '@/lib/compose-modifiers'
import { Box, Column, Row } from '@/lib/compose-ui'
import { setPreference, usePreferences } from '@/settings/preferences'
import type { ListSort } from '@/tasks/model'
import { type Filter, listSorts } from '@/tasks/views'
import { sortLabels } from '@/ui/format'
import { ChipRow, Fab, type FilterChoice } from '@/ui/primitives'
import { Action, Screen } from '@/ui/screen'
import { MenuRows, Sheet } from '@/ui/sheets'

/** What the new task's page (`/new`) starts from. */
type NewTaskParams = { list?: string; starred?: '1' }

/** A new task starts as the screen shows: in the list shown, or starred; never dated. */
function newTaskParams(list: string | null, view: Filter) {
  const params: NewTaskParams = {}

  if (list !== null) params.list = list

  if (view === 'starred') params.starred = '1'

  return params
}

const views = ['today', 'upcoming', 'starred', 'completed'] as const

function isView(value: string | undefined): value is (typeof views)[number] {
  return views.some((view) => view === value)
}

/**
 * The app's one main screen: the tasks of every list or of one, and a row of chips over them as
 * vaka's library has it. The sort chip opens the sort; the list chip opens the Lists sheet, which
 * chooses the list and keeps the lists; after a divider, Today, Upcoming, Starred and Completed
 * narrow what is shown, each tapped on and off again. All of it is where the app opens again.
 * Reminders link here with a `view`; a new task opens on a page of its own (`/new`).
 */
export function TasksScreen() {
  const { t, i18n } = useLingui()
  const router = useRouter()
  const actions = useActions()
  const preferences = usePreferences()
  const lists = useLists()
  const params = useLocalSearchParams<{ view?: string }>()
  const [sheet, setSheet] = useState<'lists' | 'sort' | null>(null)
  // What the search field holds, narrowing whatever the chips show.
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  // The lists chosen, in their own order and without any deleted since; none shows every list.
  const chosen = lists.filter((candidate) => preferences.scopes.includes(candidate.clientId))
  const scope = chosen.map((candidate) => candidate.clientId)
  const list = chosen.length === 1 ? chosen[0] : undefined
  const view: Filter = isView(params.view) ? params.view : preferences.view
  const sort: ListSort = list ? list.sort : preferences.sort

  const chooseSort = (next: ListSort) =>
    list ? actions.setListSort(list.clientId, next) : setPreference('sort', next)

  const chooseView = (next: string | null) => {
    setPreference('view', views.find((candidate) => candidate === next) ?? 'none')

    // A link's view gives way to the one tapped.
    if (params.view) router.setParams({ view: undefined })
  }

  const viewChips: FilterChoice[] = [
    {
      key: 'today',
      glyph: 'today',
      label: t({ message: 'Today', comment: 'Filter chip: tasks due today and overdue' }),
    },
    {
      key: 'upcoming',
      glyph: 'upcoming',
      label: t({ message: 'Upcoming', comment: 'Filter chip: tasks with a later date' }),
    },
    {
      key: 'starred',
      glyph: 'star',
      label: t({ message: 'Starred', comment: 'Filter chip: starred tasks' }),
    },
    {
      key: 'completed',
      glyph: 'completed',
      label: t({ message: 'Completed', comment: 'Filter chip: tasks that are done' }),
    },
  ]

  return (
    <Screen
      title={t({ message: 'Toda', comment: 'Title of the main screen: the app name' })}
      appBar='header'
      panel
      header={
        <Column modifiers={[fillMaxWidth()]}>
          <Row verticalAlignment='center' modifiers={[fillMaxWidth(), padding(16, 8, 4, 8)]}>
            <Box modifiers={[weight(1)]}>
              <SearchField query={query} onQueryChange={setQuery} />
            </Box>
            <Action
              glyph='settingsFilled'
              label={t({ message: 'Settings', comment: 'App bar button opening the settings' })}
              onPress={() => router.push('/settings')}
            />
          </Row>
          <ChipRow
            sort={{
              label: t({
                message: `Sort: ${i18n._(sortLabels[sort])}`,
                comment: 'Spoken label of the sort chip, with the chosen order',
              }),
              onPress: () => setSheet('sort'),
            }}
            scope={{
              label:
                chosen.length === 0
                  ? t({ message: 'All', comment: 'List chip while every list is shown' })
                  : (list?.title ??
                    t({
                      message: `Lists (${chosen.length})`,
                      comment: 'List chip while several lists are shown, with how many',
                    })),
              narrowed: chosen.length > 0,
              onPress: () => setSheet('lists'),
            }}
            views={viewChips}
            view={view === 'none' ? null : view}
            onView={chooseView}
          />
        </Column>
      }
      floatingAction={
        <Fab
          glyph='add'
          label={t({ message: 'New task', comment: 'Floating button adding a task' })}
          onPress={() =>
            router.push({ pathname: '/new', params: newTaskParams(list?.clientId ?? null, view) })
          }
        />
      }
    >
      <TaskList scope={scope} filter={view} sort={sort} query={deferredQuery} />
      {sheet === 'lists' ? (
        <ListsSheet
          scope={scope}
          onChoose={(next) => setPreference('scopes', next)}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'sort' ? (
        <Sheet
          title={t({ message: 'Sort by', comment: 'Title of the sort sheet' })}
          onDismiss={() => setSheet(null)}
        >
          {(close) => (
            <MenuRows
              close={close}
              rows={listSorts.map((option) => ({
                key: option,
                label: i18n._(sortLabels[option]),
                selected: option === sort,
                onPress: () => chooseSort(option),
              }))}
            />
          )}
        </Sheet>
      ) : null}
    </Screen>
  )
}
