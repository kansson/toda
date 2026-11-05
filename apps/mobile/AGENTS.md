# Toda mobile

- Android only. Route and layout files live in `src/app/` and only forward to screens in
  `src/screens/`. The main screen (`screens/tasks.tsx`) shows a scope (every list, or the lists
  chosen, kept as ids in `scopes`), a view and a sort, all kept in preferences, through `TaskList` and `browseView`; its header is
  `ChipRow` (sort, scope, divider, views) and the Lists sheet (`components/lists-sheet.tsx`) keeps
  the lists. Reminders link to it with a `view` param. A task's `listId` may be null: never
  assume a list exists, and offer `NO_LIST` wherever a list is chosen. A new task has its own page
  (`screens/new-task.tsx`): `/new` from the main screen's button, sliding in, and `/add` from
  the widgets, the launcher shortcut and sharing. `/add` is a stand-in shown without a slide that,
  two frames later, resets the stack to the main screen and `/new` (`useLinkStandIn`): a page
  pushed while the app comes back, before its window has drawn, later closes without its exit
  transition, and a link opened again must not pile one page on another. Never clear the app's task to open it (`FLAG_ACTIVITY_CLEAR_TASK`): the new activity
  mounts a second React root while the old one is still alive, so two apps run at once (React
  Navigation warns that linking is configured in multiple places). The root layout anchors the stack on `index`, so Back from a linked page returns to
  the tasks. A tap on a widget task opens its page through `/open/<id>`, a stand-in as `/add` is; a
  tap anywhere else but a check box or + opens the app with its launch intent, as its icon does,
  never a route: a pushed route would slide in over wherever the app was.
- `src/tasks/` holds the rules as pure, tested functions (dates, recurrence, completion, views,
  positions, sharing); `src/data/` the collections, outbox and session; `src/reminders/`,
  `src/widgets/` and `src/updates/` the work beside the screens, wired in
  `src/components/app-sync.tsx`.
- Check tasks off through `useTaskCommands().toggle` and render its `prompt`: a late repeating
  task asks which day it was done.
- Write data only through `useActions()` (`src/data/actions.ts`): each write is an offline action
  that must be synchronous in its `onMutate`. Never await a transaction in the UI; offline it
  stays pending for as long as the phone is offline.
- Open the data only through `openDb()` (`src/data/shared-db.ts`), so the screens and background
  work share one outbox. `src/data/polyfills.ts` must load before anything that creates a
  collection; `index.ts` imports it first.
- Build screens from `src/ui`, not from raw Expo UI. Add a named primitive when something is
  missing; screens must not name a Material Symbol or a colour role directly. New glyphs go in
  `src/ui/glyphs.ts`; filled ones come from `assets/symbols`.
- Use Expo UI's Jetpack Compose components wherever one applies. Missing pieces go in the Compose
  bridge `modules/ui` (the Scaffold with its Undo snackbar, app bars, sheets and the drag-to-
  reorder `ReorderList`), never as React Native look-alikes. The native Scaffold resolves slots
  once: keep its slots mounted. So does a `ListItem`: keep `TrailingContent` and switch what is
  inside it. Every bottom sheet is `Sheet`; never use ModalBottomSheet.
- `modules/platform` holds the self-updater, exact-alarm and notification settings, and the
  share receiver.
- The home screen widgets are native Glance in `modules/widgets`, as in the pay calculator: every
  colour is a `GlanceTheme(DynamicThemeColorProviders)` role, the layout uses Glance's Material 3
  components (`Scaffold`, `CircleIconButton`, `CheckBox`; the title row is drawn without
  `TitleBar`, whose leading icon is required), and the picker previews
  use Glance's own colour resources (`@color/glance_color*`) so they match in light, dark and
  Material You. The app writes a JSON snapshot of every source, Today, Starred and each list
  (`src/widgets/types.ts` mirrors `WidgetSnapshot.kt`; change both together), and redraws them.
  Each list widget keeps the source and sort chosen as it was placed (`TasksWidgetConfigureActivity`,
  also its reconfigure screen) by its widget id; the app writes every source's tasks in every sort
  (`src/widgets/snapshot.ts`), so the widget only picks an order and never sorts itself; a widget pinned from Settings gets the choice made
  there through the pin's callback (`PinnedWidgetReceiver`). A check box records the task
  natively and the app completes it through `takeCompletions`. All text reaches them translated
  in the snapshot, with fallbacks in the module's string resources.
- Colour roles follow Material 3: screens on `surface`, cards on `surfaceContainerHigh`, sheets on
  `surfaceContainerLow`; colour comes from the dynamic palette.
- Keep app identity in `config/app-identity.ts`. The server is the phone's (`src/data/server.ts`);
  `config/backend.ts` only finds a development build's. Never reuse another project's package, signing or store identifiers.
- Add user-facing strings through Lingui with translator comments. Extract, translate the Swedish
  for real and compile; compiled catalogs stay ignored.
- Native dependency or module changes need `vp run mobile:generate` and a rebuild. Do not edit
  generated `android/` files; use config plugins (`app.config.ts`, `config/plugins`) and
  `modules/`. Build with JDK 17 and `ANDROID_HOME` set.
- Hermes here lacks `Array.prototype.toSorted` and friends: use `slice().sort()`.
- Background notification tasks get the reminder's data as JSON in `content.dataString`, the
  listener as `content.data`; `reminders/response.ts` reads both and is tested on a real payload.
- Class-based Compose views (`View(ReorderListView::class)`) must declare their events in
  `TodaViewsModule.kt`, or JavaScript never hears them.
- Stack screens move as the system Settings app's pages do, ported from vaka. They open and close
  with Android 17's activity transitions (`config/android-transitions`, installed over
  react-native-screens' `default` by a config plugin), started only once the new screen has drawn
  (`StackEnter.kt`) and with the system's edge extension (`StackEdges.kt`). A back swipe runs
  WindowManager Shell's cross-activity animation between stack screens (`StackBack.kt`) and
  dismisses the top screen natively on commit. It reaches into react-native-screens' stack: retest
  it on the emulator after upgrading that library.
- React Native keeps one back callback always on, which hides Android's predictive back-to-home.
  `SystemBack` (`src/components/system-back.tsx`, native `SystemBack.kt`) turns it off on the
  main screen, so a JS `BackHandler` there never fires. It reads a private field of
  `ReactActivity` and is pinned to React Native 0.88.1: review it when upgrading.
- A committed back preview skips JavaScript's `BackHandler`, so wherever one takes Back for itself
  it also calls `useBackPreviewBlocked`. A closing screen's Compose content would redraw empty, so
  `Screen` keeps its last frame through the transition (`LeavingFrame`), holding the removal with
  `usePreventRemove`; a committed back swipe tells JavaScript first (`onNativeDismissal`), and the
  screen lets go then.
- The app icon, its themed and notification forms and the splash image are drawn by
  `scripts/generate-icons.ts` (`pnpm run mobile:icons`); edit the script, never the PNGs. The
  splash sits on the app's own surface colour (`withSurfaceSplash`), never a brand colour.
- The licences under Settings → About come from `scripts/generate-licenses.ts`
  (`pnpm run mobile:licenses`, into `src/about/licenses.json`); run it after changing
  dependencies, and update its list of native libraries when those change.
- Format dates and times only through `src/ui/format.ts` (`formatDate`, `timeLabel`, never
  `i18n.date`): the app's language in the phone's region (`en-SE`), and the phone's own 12- or
  24-hour clock rather than the language's.
- Metro loses track of files while Gradle regenerates `android/`; restart it with `--clear`.
- Test on an emulator; never drive the owner's phone.
- After a native change, build the development APK (`./gradlew :app:assembleDebug` in
  `android/`, or `vp run mobile:android`) and install it on the owner's phone whenever one is
  connected (`adb devices`; `adb -s <serial> install -r`), keeping its data. Installing is not
  driving it: leave the app's UI to the owner.
