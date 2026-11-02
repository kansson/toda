# Toda mobile

The Android app. See the [repository guide](../../README.md) to run it and [docs](../../docs) for
how it works.

## Structure

- `src/app/`: routes only, forwarding to `src/screens/`.
- `src/screens/`: Home, a list, a task, Today/Upcoming/Starred, search, settings and pairing.
- `src/ui/`: the app's vocabulary (`Screen`, `List`, `Group`, `Empty`, `Sheet`, dialogs, glyphs
  and date wording).
- `src/components/`: larger pieces shared by screens: the task row, the new-task sheet, the repeat
  editor, the pickers and `AppSync`.
- `src/tasks/`: the rules, pure and tested.
- `src/data/`: TanStack DB collections over Convex, the outbox, the session and pairing.
- `src/reminders/`, `src/widgets/`, `src/updates/`, `src/settings/`.
- `modules/ui` (Compose views) and `modules/platform` (updates, alarms, widgets, sharing).

## App identity

`config/app-identity.ts` is the single source of app names, package IDs and link schemes
(`app.toda.android` with `.dev`/`.preview` suffixes; schemes `toda`, `toda-dev`, `toda-preview`).
