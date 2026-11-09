import { Widgets } from '../../modules/widgets'
import type { WidgetSnapshot } from './types'

let writing: Promise<void> = Promise.resolve()

/** The last round of widget check-offs this app has taken and completed; none yet on a start. */
let completedRound: number | null = null

/**
 * Hands the widgets what to show, one write at a time; the last one wins. Build `snapshot` from
 * the collections as they are now, not from an earlier render: it tells the widgets that every
 * check-off taken so far is completed in it, so they stop hiding those tasks.
 */
export function updateWidgets(snapshot: WidgetSnapshot) {
  const json = JSON.stringify({ ...snapshot, completedRound })

  // A launcher that fails one update must not hold back the next.
  writing = writing.catch(() => undefined).then(async () => await Widgets?.update(json))

  return writing
}

/**
 * Completes the tasks checked off in a widget since the app last asked, once each, as done at the
 * moment each was checked off: the app may take them hours later, past midnight. `complete` must
 * write synchronously, so that every snapshot built after this returns shows them done.
 */
export function completeWidgetTasks(complete: (taskId: string, checkedAt: number) => void) {
  const taken = Widgets?.takeCompletions()

  if (!taken) return

  taken.taskIds.forEach((taskId, index) => complete(taskId, taken.checkedAt[index] ?? Date.now()))
  completedRound = taken.round
}

/** Called when a task is checked off in a widget while the app runs. */
export function onWidgetCompletion(listener: () => void) {
  const subscription = Widgets?.addListener('onCompleted', listener)

  return () => subscription?.remove()
}

/** Redraws the widgets in the system's current palette. */
export function redrawWidgets() {
  void Widgets?.redraw().catch(() => undefined)
}

/**
 * Asks the launcher to add a widget to the home screen, a list widget showing `source` (`today`,
 * `starred` or a list's id); false where it cannot.
 */
export function pinWidget(kind: 'tasks' | 'newTask', source: string | null = null) {
  return Widgets?.requestPin(kind, source) ?? false
}
