import { type NativeModule, requireOptionalNativeModule } from 'expo'

declare class WidgetsNativeModule extends NativeModule<{ onCompleted: () => void }> {
  /** Stores what the widgets show (JSON) and redraws them. */
  update(snapshot: string): Promise<void>
  /** Redraws the widgets, as after the system palette changed. */
  redraw(): Promise<void>
  /**
   * Tasks checked off in widgets since the last call, once, and the round they were taken in;
   * the widgets keep them hidden until a snapshot carries that round as `completedRound`.
   */
  takeCompletions(): { taskIds: string[]; round: number }
  /** Asks the launcher to add a widget, a list widget showing `source`; false where it cannot. */
  requestPin(kind: 'tasks' | 'newTask', source: string | null): boolean
}

/** The app's Glance widgets; null where the native module is not linked, such as in tests. */
export const Widgets = requireOptionalNativeModule<WidgetsNativeModule>('TodaWidgets')
