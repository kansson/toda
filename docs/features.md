# Features

What Toda does, and where it follows or departs from Google Tasks (inventoried from its
2026.10.26 Android release). Screens are in `apps/mobile/src/screens`; the rules they apply are
pure functions in `apps/mobile/src/tasks`, each with tests.

Screens move as the system Settings app's pages do, as in vaka: they open and close with
Android 17's activity transitions, and a back swipe previews the screen below with the system's
cross-activity animation. On the main screen Back belongs to Android, which previews going home.
Dates and times read in the app's language but are laid out as the phone's region has them
(English on a phone set to Sweden shows "Mon, 9 Nov"), and times of day follow the phone's own 12-
or 24-hour clock.

## Lists

- Every account starts with one list, named "My Tasks" in the phone's language (`default`). Any
  list can be renamed or deleted, that one too; a task needs no list, and the app works with none.
- The main screen shows the tasks of every list, or of the lists chosen, under the search field
  and a row of chips as
  vaka's library has: the sort chip (an icon), the list chip (**All**, the list's name when one
  is chosen, or **Lists (n)** for several, highlighted while any are), a divider, then
  **Today**, **Upcoming**, **Starred** and **Completed**, each tapped on and off again. A view
  narrows whatever lists are shown. All of it is where the app opens again.
- The list chip opens the **Lists** sheet: one card per list, ticked on and off with the sheet
  staying open, and held to drag it into a new order, the card staying within the sheet's list
  as the list scrolls under it; each has a menu to rename or delete it. Its title row adds a
  list, goes back to every list and closes the sheet. With no lists it says so. Deleting a list
  deletes its tasks.
- Several lists shown together are grouped by list in their order, tasks in no list last when
  every list is shown.
- The sort is Relevance (the order arranged by hand), Date, Deadline, Starred recently or Title,
  the same five as Google Tasks, chosen in the Sort by sheet. One list shown alone keeps its own
  sort; otherwise the main screen keeps one. Date sorts into Overdue, Today, Tomorrow, Later and
  No date; Deadline into Past deadline, Today, Tomorrow, Later and No deadline; Starred recently
  into Starred recently (within 30 days), Starred earlier and Not starred (`tasks/views.ts`).
- In Relevance with one list shown, open tasks are held and dragged into place (`ReorderList`, a
  native Compose list), staying within the list in view as it scrolls under them.
  A task moves among its siblings; a subtask among its parent's subtasks.
- Done tasks gather under Completed (n), closed by default and remembered per list. The list menu
  deletes them all, with Undo.

## Tasks

- A task has a title (up to 1023 characters), details (up to 4095), a date with an optional time,
  a deadline (date only), a star and subtasks, one level deep, as in Google Tasks.
- New tasks are added at the top of a list on a page of their own, laid out as a task's page:
  the list, title and details, date and time, repeat, deadline, star and subtasks, all set before
  the task exists. Save, enabled once there is a title, adds it; leaving the page any other way keeps it too, unless it has no
  title. The floating button opens it on the list shown, and from Starred with the star set; a
  new task never starts with a date. From a widget's +, the launcher shortcut or a share it opens with no
  slide.
- Both pages have a large app bar. The new task's is titled New task, over its one text field,
  the title, which starts unfocused and whose keyboard Done only puts the keyboard away. A task's
  page is titled with the task's name, renamed in a dialog from the bar's edit action, and its
  floating button marks it done or not done. Then cards: the details, edited in a dialog, the
  list, date, time, repeat and deadline, each set one with a button to clear it, and Subtasks,
  whose + adds one in a dialog. A task's page saves every change as it is made; deleting asks
  first. Dialogs that take text start with the cursor after what is there. Subtasks are checked off,
  opened and removed there, and a subtask can be made a task of its own.
- Completing a task completes its open subtasks. Reopening it reopens those done with it.
  Completing and deleting show a snackbar with Undo.
- Tasks move to another list with their subtasks from the list card on a task's page, which picks
  among the lists and is cleared with its button to leave the task in none. With no lists it says
  so in a snackbar.
- A time without a date is impossible; removing the date removes the time and the repeat.

## Repeats (`tasks/recurrence.ts`)

The reason Toda exists. A repeat is every N days, weeks, months or years, and counts either:

- **When done** (the default): the next occurrence comes a whole interval after the day the
  current one is completed. A three-day chore due Monday and done Tuesday comes back Friday.
  Done early, it also counts from that day.
- **On a fixed schedule**: as Google Tasks does, the dates stay put. A weekly repeat falls on
  chosen weekdays; a monthly one on a day of the month (the last day where a month is shorter,
  without drifting) or the nth or last weekday. Occurrences that passed before the task was done
  are skipped, so only one is ever open.

Either way a repeat ends never, on a date, or after a number of times.

The repeat sheet is a column of cards with Done in its title row: **Fixed schedule**, a switch
(off counts from when done); **Repeats every**, a dialog for the number and the unit; the weekdays
when a fixed repeat is weekly, or the day when it is monthly; and **Ends**, on a date or after a
number of times. Nothing is chosen for a new repeat: how often and the end start unset, a set one
opens its own dialog again, and its clear button unsets it (an end so cleared means never). Done
without how often leaves the task not repeating. The repeat it makes is spelled out at the bottom,
and the sheet stays where it is while a dialog over it has the keyboard. A task's page removes a
repeat with the card's clear button.

Completing an occurrence
leaves it in Completed and creates the next one as a new task with the same details, star and
subtasks (open again), and the snackbar says when it comes back. That next occurrence stays out of
lists, widgets and Today until its day, so a series shows one open task at a time. Undo, or
reopening the done one, takes the new occurrence back while it is still open.

Repeating tasks carry no deadline, as in Google Tasks: making a task with a deadline repeat asks
first and removes it.

## Views and search

These are the chips after the divider; each narrows the tasks of the lists shown, and the sort
orders tasks within its sections unless it is Relevance.

Every group of tasks, a view's or a sort's, sits under a compact label with how many tasks it
holds; tapping it folds the group away and back, its rows fading and the rest sliding into place.
A group that holds everything shown and says nothing, such as No date when no task shown has a
date, goes without one. Changing the view or sort keeps the one list on screen and only moves its
rows. The main screen's bar and chips sit on a tinted backdrop and stay put; the tasks scroll on
a panel whose top corners curve down into it. A task's row shows every line of its details.

- **Today**: open tasks dated today or earlier, under Overdue and then Due today.
- **Upcoming**: open tasks dated later, by day for two weeks, then Later.
- **Starred**: open starred tasks, most recently starred first.
- **Completed**: done tasks, most recently done first. Settings → Tasks deletes every done task.
- **Search** (not in Google Tasks): the field at the top of the main screen, in place of the app's
  name, beside Settings. Every word of the query in a title or details, ignoring case and accents,
  narrows whatever the chips show, in their groups; a subtask found keeps its task over it. The
  keyboard's search key, a tap outside the field and leaving the screen put the keyboard away; its
  clear button empties it and focuses it again. With nothing found it says so, centred in what
  the keyboard leaves in view.

## Reminders (`reminders/`)

- A task with a time notifies at that minute on the "Tasks at a time" channel. Android asks to
  allow exact alarms; Settings explains it when they are off.
- The morning summary (09:00 by default, another time or off in Settings) lists the day's tasks
  without a time and counts those overdue, on the "Today's tasks" channel. Google Tasks fixes it
  at 09:00.
- A single task's notification has **Mark done** and **Tomorrow**. Both work while the app is
  closed: Android runs a background task that writes them to the outbox like any other change,
  which reaches the server the next time the app is online in the foreground.
- Reminders are rescheduled from the data after every change, so none outlives its task.

## Home screen

- **Tasks widget** (four cells wide by default, resizable), drawn natively with Glance: Today,
  Starred or a list, chosen as it is placed, as in Google Tasks, and changed later through the
  widget's settings on a long press. The same screen sorts it by any of the app's sorts, Save
  keeping both; until one is chosen it follows the list's own sort in the app, Today and Starred
  their own order, and a sort sorts Today and Starred within their sections, as the main screen
  does. Each widget keeps its own, so several can show different lists or sorts. Its open tasks sit under its title, in bold beside a tonal +, on its own background, each with a
  round toggle whose ripple is round, as in the app; with none open it shows the done glyph over No tasks, centred under its title. A
  tap on a task opens its page in the app; anywhere else but a toggle or +, the space under the
  tasks and the empty state included, opens the app as its icon does, with one ripple across the
  whole card. Tasks that fit stand still; more scroll, where it was left. A task's check box
  takes it off every widget at once, natively; the app completes it, with its repeat and sync, at
  once while it runs and otherwise on its next start or return, and + adds a task to it. Every
  colour is a dynamic Material 3
  role, light or dark with the system, and the widget picker shows a preview in the same roles.
- Settings → Home screen widget → **Add to home screen** asks what it should show, then asks the
  launcher to place it.
- **New task widget** and a **New task** launcher shortcut open the new task's page.
- Text shared from another app opens a new task: a subject becomes the title and the text the
  details, or the first line the title and the rest the details (`tasks/share.ts`).

## Phones and accounts

- A published build has no server of its own. The first launch asks for the address of a Convex
  deployment (`https://` assumed) and keeps it once `/version` answers as Convex does
  (`components/server-setup.tsx`). Settings → Sync → **Server** changes it: the phone's copy and
  unsent changes are deleted, and it signs in on the new server with the same credential, so
  going back returns to the same account. A development build starts on the checkout's own
  deployment.
- There is no sign-up. Each install gets an account of its own through a random credential kept
  in the phone's secure storage.
- **Link another phone** (Settings → Your phones) shows a code that works once for ten minutes.
  Typing it on another phone under "I have a code" moves that phone onto this account; what it
  had is deleted if no other phone shares it.
- **Start over on this phone** leaves the account; **Delete all tasks and lists** deletes it on
  the server and every phone.
- Settings → About lists the app's version and, under **Licenses**, every open-source package and
  native library it ships with, each opening its licence text.

## Not carried over from Google Tasks

Google-only integrations (Gmail, Chat and Docs tasks, Keep, Calendar, assignees, attachments) and
multiple Google accounts.
