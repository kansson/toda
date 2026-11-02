import { Widgets } from '../../modules/widgets'
import type { WidgetSnapshot } from './types'

let writing: Promise<void> = Promise.resolve()

/** Hands the widgets what to show, one write at a time; the last one wins. */
export function updateWidgets(snapshot: WidgetSnapshot) {
  const json = JSON.stringify(snapshot)

  // A launcher that fails one update must not hold back the next.
  writing = writing.catch(() => undefined).then(async () => await Widgets?.update(json))

  return writing
}

/** Tasks checked off in a widget since the app last asked, once each. */
export function takeWidgetCompletions() {
  return Widgets?.takeCompletions() ?? []
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
