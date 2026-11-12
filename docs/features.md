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
  native Compose list), staying within the list in view as it scrolls under them. A held task
  is tinted in its row's rounded outline, with no shadow.
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
  first. Dialogs that take text start with the cursor after what is there. Subtasks are opened
  and removed there, removing asking first; their circles only show whether each is done, as a
  subtask is checked off on its own page or in the list. A subtask stays a subtask.
- Completing a task completes its open subtasks. Reopening it reopens those done with it.
  Reopening a subtask of a done task, as from Completed, reopens the task too, since a task is
  done only once all its subtasks are; its other subtasks stay done.
  Completing and deleting show a snackbar with Undo.
- A task's subtasks end in switches, in the same run of cards (not in Google Tasks): **Done when
  its subtasks are** and, on a repeating task with two or more, **Take turns, one each time** (see
  Subtasks of a repeating task). With the first on, checking off the last of its subtasks due this
  time, in the list, on its page or in a widget, does the task too, as if the task itself were
  checked off. Subtasks resting this time are not waited for. A daily _Workout_ with _Stretch_ and
  _Run_ is done once both are; the task's own check box still does it with all its subtasks at
  once.
- A new task's subtasks open as a subtask's page does, in a sheet before the task exists: its
  title, and when it is due once the task repeats, set as on its page. The switches are there too.
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

A repeating task whose date has passed asks **When did you do it?** as it is checked off, in the
list or on its page: today, each day back to its own date (a week at most), or another day from a
calendar, each saying when the task comes back if that day is taken. A daily task forgotten
yesterday and marked done on yesterday comes back today, where marking it done today would bring
tomorrow's; the done occurrence is recorded on that day. Closing the
sheet leaves the task open. A subtask whose check-off would do its late repeating task asks the same, for that task. A widget's check box asks too: on such a task it opens the app on the
task's page with the question over it, and once a day is taken the page goes back to the tasks
with the snackbar; closing the question leaves the task open on its page. The widget tells from
the task's date and the phone's, redrawn just after midnight, so a task that turns late while the
app is closed asks as well. A notification's Mark done cannot ask, so it counts the day it was
tapped, as a widget does for every other task (`tasks/completion.ts`): a widget keeps the moment
of each check-off, so a task checked off on Sunday evening and taken by the app after midnight is
still done on Sunday.

Repeating tasks carry no deadline, as in Google Tasks: making a task with a deadline repeat asks
first and removes it.

### Skipping days

Not in Google Tasks. Under **Skip**, the repeat sheet has a second run of cards laid out as the
first: each shows what it skips, or what it sets dimmed while it skips nothing, opens one dialog
and is cleared with its button. What they skip is spelled out after the rule ("Daily · Skips
Sunday").

| Card                                                                                                                       | Example                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Skip days of the week** (not on a fixed weekly repeat, whose days are chosen already)                                    | Walk the dog daily, skipping Sunday                                                        |
| **Skip months**                                                                                                            | Water the garden weekly, skipping October to March: "Only in Apr, May, Jun, Jul, Aug, Sep" |
| **Take turns with another task**, then on a card under it whether it skips the days that task is due or falls only on them | Run daily, skipping the days _Gym_ is due                                                  |

Days of the week and months are ticked in a list of those skipped, never all of them; each says
the shorter of what it skips and what it keeps. The repeat's conditions are stored as the general
rule below, which the sheet reads and writes in this one form; the rule can also leave out a run
of days, which the sheet does not offer but keeps and spells out.

A date stays on the schedule when every "only" condition holds and no "except" one does. A date
left out moves the task on: a fixed schedule to its next date that is kept, one counted from
when it is done to the next day that is kept. "Ends after" counts only the times kept, and a
repeat whose next kept date comes after its end ends. Conditions that leave out every date for
ten years are let go of rather than the task never coming back.

Another task is named by its series, so the condition goes on meaning that task as it repeats.
It is due on its own date, done or not, and on the dates it comes back on, each counted as done on
its day, following its weekday, month and date conditions but not its own task conditions, so
two tasks that name each other never go round in a circle. Two tasks take turns with "Not when
the other is due" on one of them: _Paper bins_ every other week, and _Plastic bins_ weekly, not
when _Paper bins_ is due. A task that is gone holds on no day, and its condition says so. The
done-day sheet and the snackbar say when a task is really back; a subtask's cadence counts its
task's dates by the weekday, month and date conditions only.

### Subtasks of a repeating task (`tasks/cadence.ts`)

Not in Google Tasks. A subtask of a repeating task is due every time by default; its page has a
**Due every time the task repeats** card that chooses otherwise, in a sheet laid out as the
repeat sheet (**When it’s due**), its answer and when the subtask is next due spelled out at the
bottom:

- **Every few times**: once every N times the task repeats, starting this time or a few times
  on. Changing the filter on every third cleaning.
- **On its own schedule**: **Fixed schedule** first, as in the repeat sheet, then every N days,
  weeks, months or years. Its dates are **fixed** (the default, from a first date chosen in the
  sheet) or, with Fixed schedule off, each counts from the day it was last done. Each date lands
  on one of the task's, chosen in a dialog of just their names:
  - **Closest date**: whichever is nearer, the earlier on a tie.
  - **Never late**: the task's last date on or before it.
  - **Never early**: the task's first date on or after it.

  Never late and never early take a **leeway** of days ("Up to 2 days late is fine"): a date that
  far on the other side takes it instead when that one is nearer. A monthly descaling meant for
  the 1st on a Saturday chore, never early with three days' leeway, takes the Saturday two days
  before rather than waiting until the 6th.

  A schedule the task keeps up with anyway, such as a weekly one on a weekly task, says in the
  sheet that it is due every time anyway.

The task's coming dates are counted as if each is done on its day. A task whose date has passed
counts from today instead, as it would if done now: whether a subtask is due is judged against
the date the task would really come back on, which for a task that repeats from when it is done
is later the later it is done, and a subtask whose own date passed while the task waited is due
now.

**Take turns, one each time**, under the subtasks of a repeating task with two or more, makes them
come round one each time the task repeats, in their order, and turns on Done when its subtasks
are. _Bins_, weekly, with _Paper_ and _Plastic_: Paper this week, Plastic the next, and checking
off the one whose turn it is does the week. Each subtask carries the every-few-times cadence that
makes it so, kept in step as subtasks are added, deleted, restored, moved or reordered: the one
whose turn it is keeps it and the others follow in their order. Their pages say they take turns
in place of the cadence card, and those not up this time say on their rows when their turn is. Turning it off
makes every subtask due every time again. A subtask with a cadence of its own says it on its row
("Once every 3 times").

A subtask that is due in the task's current occurrence says so on its page ("Due with the task
today"). One that is not rests in that occurrence: it is left out of the lists, left open when
the task is done, and on the task's page dimmed, with the upcoming glyph, saying when it is next
due ("Skips 3 times, next due on Sat, 28 Nov"), or "Skipped this time" under a done task. Each
occurrence carries every subtask on; one on its own schedule that was due moves on to its next
date. A subtask moved to another list on its own, or a task made a subtask, leaves its cadence
behind.

## Views and search

These are the chips after the divider; each narrows the tasks of the lists shown, and the sort
orders tasks within its sections unless it is Relevance. In every view a task's subtasks follow
it, as in its list, and stay with it whatever the sort; a starred subtask shows once in Starred,
on a row of its own.

Every group of tasks, a view's or a sort's, sits under a compact label with how many tasks it
holds; tapping it folds the group away and back, its rows fading and the rest sliding into place.
A group that holds everything shown and says nothing, such as No date when no task shown has a
date, goes without one. Changing the view or sort keeps the one list on screen and only moves its
rows. The main screen's bar and chips sit on a tinted backdrop and stay put; the tasks scroll on
a panel whose top corners curve down into it. A task's row shows every line of its details. A
subtask's row says nothing of its cadence, which its page and its task's page show.

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
  does. Each widget keeps its own, so several can show different lists or sorts. Its open tasks sit under its title, in bold beside a tonal +, on its own background, each followed by
  its open subtasks drawn in under it, as the app lists them, those not due this time left out;
  each has a
  round toggle whose ripple is round, as in the app; with none open it shows the done glyph over No tasks, centred under its title. A
  tap on a task opens its page in the app; anywhere else but a toggle or +, the space under the
  tasks and the empty state included, opens the app as its icon does, with one ripple across the
  whole card. Tasks that fit stand still; more scroll, where it was left. A task's check box
  takes it off every widget at once, natively, with its subtasks; the app completes it, with its
  repeat and sync, at
  once while it runs and otherwise on its next start or return, as done when it was checked off.
  A late repeating task's check box instead opens the app to ask which day it was done (see
  Repeating tasks). + adds a task to it. Every
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
