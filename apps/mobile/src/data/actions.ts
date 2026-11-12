import { turnChanges } from '@/tasks/cadence'
import {
  checkedOff,
  completedBy,
  completionMoment,
  planCompletion,
  planReopen,
} from '@/tasks/completion'
import { seriesOf, seriesSchedules } from '@/tasks/conditions'
import { type CalendarDate, localDate } from '@/tasks/dates'
import {
  type Cadence,
  type List,
  type ListSort,
  newTask,
  type NewTask,
  type Task,
} from '@/tasks/model'
import { bottomPosition, placeInOrder, topPosition } from '@/tasks/positions'
import type { Db } from './db'
import { newId } from './ids'

/** Fields of a task the editor changes directly. */
export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'notes'
    | 'dueDate'
    | 'dueTime'
    | 'deadline'
    | 'starredAt'
    | 'repeat'
    | 'cadence'
    | 'completion'
    | 'listId'
    | 'position'
  >
>

/** A subtask made with its task: its title, and when it is due where not every time. */
export type NewSubtask = { title: string; cadence?: Cadence | null }

/** What completing a task did, for the confirmation and its Undo. */
export type Completion = { taskId: string; nextDue: string | null; spawned: string[] }

/**
 * Every write the app makes, each one offline action: it shows at once, is kept in the outbox,
 * and reaches the server as one transaction, in order, whenever the phone is online. A write the
 * server refuses is undone on the phone and `onRefused` is told.
 */
export function createActions(db: Db, onRefused: () => void) {
  const { lists, tasks, executor } = db

  function action<T>(onMutate: (variables: T) => void) {
    const run = executor.createOfflineAction<T>({ mutationFnName: 'applyOperations', onMutate })

    return (variables: T) => {
      const transaction = run(variables)

      // Never awaited: offline, a write stays pending for as long as the phone is.
      transaction.when('settled').catch(() => onRefused())
    }
  }

  const allTasks = () => [...tasks.values()]

  const subtasksOf = (parentId: string) => allTasks().filter((task) => task.parentId === parentId)

  const openSiblings = (listId: string | null, parentId: string | null) =>
    allTasks()
      .filter(
        (task) => task.listId === listId && task.parentId === parentId && task.completedAt === null,
      )
      .map((task) => ({ id: task.clientId, position: task.position }))

  const now = () => Date.now()

  /**
   * Keeps the subtasks of each task named taking turns in step with what they are now, after
   * one comes, goes or moves. Tasks that do not take turns keep their subtasks' cadences.
   */
  function keepTurns(parentIds: Iterable<string | null>) {
    const today = localDate(now())

    const changes = [...new Set(parentIds)].flatMap((parentId) => {
      const parent = parentId === null ? undefined : tasks.get(parentId)

      if (!parent?.turns || parent.parentId !== null) return []

      return turnChanges(parent, subtasksOf(parent.clientId), today).map(({ id, cadence }) => ({
        id,
        patch: { cadence },
      }))
    })

    if (changes.length > 0) moveTasks({ changes })
  }

  const insertList = action<List>((list) => {
    lists.insert(list)
  })

  const updateList = action<{
    id: string
    patch: Partial<Pick<List, 'title' | 'sort' | 'position'>>
  }>(({ id, patch }) => {
    lists.update(id, (draft) => {
      Object.assign(draft, patch)
    })
  })

  const removeList = action<{ id: string }>(({ id }) => {
    const owned = allTasks()
      .filter((task) => task.listId === id)
      .map((task) => task.clientId)

    if (owned.length > 0) tasks.delete(owned)
    lists.delete(id)
  })

  const reorderLists = action<{ changes: { id: string; position: number }[] }>(({ changes }) => {
    for (const change of changes)
      lists.update(change.id, (draft) => {
        draft.position = change.position
      })
  })

  const insertTasks = action<{ rows: Task[] }>(({ rows }) => {
    tasks.insert(rows)
  })

  const patchTasks = action<{ ids: string[]; patch: Partial<Task> }>(({ ids, patch }) => {
    tasks.update(ids, (drafts) => {
      for (const draft of drafts) Object.assign(draft, patch)
    })
  })

  const moveTasks = action<{ changes: { id: string; patch: Partial<Task> }[] }>(({ changes }) => {
    for (const change of changes)
      tasks.update(change.id, (draft) => {
        Object.assign(draft, change.patch)
      })
  })

  const removeTasks = action<{ ids: string[] }>(({ ids }) => {
    tasks.delete(ids)
  })

  const complete = action<{ ids: string[]; at: number; spawn: Task[] }>(({ ids, at, spawn }) => {
    tasks.update(ids, (drafts) => {
      for (const draft of drafts) draft.completedAt = at
    })

    if (spawn.length > 0) tasks.insert(spawn)
  })

  const reopen = action<{ ids: string[]; remove: string[] }>(({ ids, remove }) => {
    if (remove.length > 0) tasks.delete(remove)
    tasks.update(ids, (drafts) => {
      for (const draft of drafts) draft.completedAt = null
    })
  })

  return {
    /** A new list at the end of the overview; returns its id. */
    createList(title: string) {
      const id = newId()

      insertList({
        clientId: id,
        title: title.trim(),
        position: bottomPosition(
          [...lists.values()].map((list) => ({ id: list.clientId, position: list.position })),
        ),
        sort: 'manual',
        createdAt: now(),
        updatedAt: now(),
      })

      return id
    },

    renameList(id: string, title: string) {
      updateList({ id, patch: { title: title.trim() } })
    },

    setListSort(id: string, sort: ListSort) {
      updateList({ id, patch: { sort } })
    },

    /** Deletes a list with its tasks; any list can go, the first one too. */
    deleteList(id: string) {
      removeList({ id })
    },

    /** Puts lists in the order given, moving only those that need it. */
    reorderLists(order: string[], moved: string) {
      const siblings = [...lists.values()].map((list) => ({
        id: list.clientId,
        position: list.position,
      }))

      const changes = placeInOrder(siblings, order, moved)

      if (changes.length > 0) reorderLists({ changes })
    },

    /**
     * A new task at the top of its list, or at the end of its parent's subtasks, with `subtasks`
     * (their titles, and when each is due) under it in order; returns its id. The task and its subtasks are one write,
     * so the server never sees a subtask before its task.
     */
    createTask(fields: NewTask, subtasks: readonly NewSubtask[] = []) {
      const id = newId()
      const at = now()
      const parentId = fields.parentId ?? null
      const siblings = openSiblings(fields.listId, parentId)

      const task = newTask(
        id,
        {
          position: parentId === null ? topPosition(siblings) : bottomPosition(siblings),
          ...fields,
          title: fields.title.trim(),
        },
        at,
      )

      const children = subtasks.map((subtask, index) =>
        newTask(
          newId(),
          {
            listId: fields.listId,
            parentId: id,
            title: subtask.title.trim(),
            position: index,
            cadence: subtask.cadence ?? null,
          },
          at,
        ),
      )

      insertTasks({ rows: [task, ...children] })
      // A subtask joins its task's turns; a new task taking turns starts them.
      keepTurns([parentId, id])

      return id
    },

    updateTask(id: string, patch: TaskPatch) {
      patchTasks({ ids: [id], patch })
    },

    /**
     * Makes a repeating task's subtasks take turns, one each time it repeats, and the task done
     * once the one whose turn it is is done; or makes them all due every time again.
     */
    setTurns(id: string, turns: boolean) {
      const task = tasks.get(id)

      if (!task || task.parentId !== null) return
      const today = localDate(now())

      const changes: { id: string; patch: Partial<Task> }[] = [
        { id, patch: turns ? { turns, completion: 'subtasks' } : { turns } },
        ...turnChanges({ ...task, turns }, subtasksOf(id), today).map((change) => ({
          id: change.id,
          patch: { cadence: change.cadence },
        })),
      ]

      moveTasks({ changes })
    },

    setStarred(id: string, starred: boolean) {
      patchTasks({ ids: [id], patch: { starredAt: starred ? now() : null } })
    },

    /**
     * Checks a task off, as done today, on an earlier `day`, or at the moment `checkedAt` it was
     * checked off somewhere the app only hears of later, as in a widget; a repeating one gets its
     * next occurrence, counted from that day where its repeat counts from completion. The last
     * subtask due this time of a task done with its subtasks does that task too.
     */
    complete(
      id: string,
      day: CalendarDate | null = null,
      checkedAt: number | null = null,
    ): Completion | null {
      const checkedTask = tasks.get(id)

      if (!checkedTask || checkedTask.completedAt !== null) return null
      const current = now()
      const all = allTasks()
      const task = completedBy(checkedTask, all, localDate(current))
      const checked = checkedAt === null ? null : checkedOff(checkedAt, current)
      const doneOn = day ?? checked?.day ?? localDate(current)
      const at = checked?.at ?? completionMoment(doneOn, current)
      const schedules = seriesSchedules(all, seriesOf(task))

      const plan = planCompletion(
        task,
        subtasksOf(task.clientId),
        current,
        newId,
        doneOn,
        schedules,
      )

      // The subtask checked off is done even if it was resting this time.
      const ids = plan.complete.includes(id) ? plan.complete : [...plan.complete, id]

      complete({ ids, at, spawn: plan.spawn })

      return {
        taskId: task.clientId,
        nextDue: plan.nextDue,
        spawned: plan.spawn.map((row) => row.clientId),
      }
    },

    /** Opens a done task again, taking back the occurrence its completion made. */
    reopen(id: string) {
      const task = tasks.get(id)

      if (!task || task.completedAt === null) return
      const plan = planReopen(task, subtasksOf(id), allTasks())

      const removed = plan.remove.flatMap((removedId) => [
        removedId,
        ...subtasksOf(removedId).map((row) => row.clientId),
      ])

      reopen({ ids: plan.reopen, remove: removed })
    },

    /** Undoes a completion exactly: the task and its subtasks open, the new occurrence gone. */
    undoCompletion(completion: Completion) {
      const task = tasks.get(completion.taskId)

      if (!task) return

      const ids = [
        task.clientId,
        ...subtasksOf(task.clientId)
          .filter((row) => row.completedAt === task.completedAt)
          .map((row) => row.clientId),
      ]

      const spawned = completion.spawned.filter((spawnedId) => tasks.has(spawnedId))

      reopen({ ids, remove: spawned })
    },

    /** Deletes tasks with their subtasks and returns what went, for Undo. */
    deleteTasks(ids: string[]): Task[] {
      const removed = new Map<string, Task>()

      for (const id of ids) {
        const task = tasks.get(id)

        if (!task) continue
        removed.set(id, task)

        for (const subtask of subtasksOf(id)) removed.set(subtask.clientId, subtask)
      }

      if (removed.size > 0) {
        removeTasks({ ids: [...removed.keys()] })
        keepTurns([...removed.values()].map((task) => task.parentId))
      }

      return [...removed.values()]
    },

    /** Puts deleted tasks back as they were, parents first. */
    restoreTasks(rows: Task[]) {
      const ordered = rows
        .slice()
        .sort((a, b) => Number(a.parentId !== null) - Number(b.parentId !== null))

      const missing = ordered.filter((row) => !tasks.has(row.clientId))

      if (missing.length === 0) return
      insertTasks({ rows: missing })
      keepTurns(missing.map((row) => row.parentId))
    },

    /** Deletes the done tasks of a list, or of every list, and returns them, for Undo. */
    deleteCompleted(listId: string | null = null) {
      const done = allTasks().filter(
        (task) =>
          (listId === null || task.listId === listId) &&
          task.completedAt !== null &&
          task.parentId === null,
      )

      return this.deleteTasks(done.map((task) => task.clientId))
    },

    /** Moves a task with its subtasks to the top of another list. */
    moveToList(id: string, listId: string | null) {
      const task = tasks.get(id)

      if (!task || task.listId === listId) return
      const top = task.parentId === null ? task : tasks.get(task.parentId)

      if (!top) return
      const position = topPosition(openSiblings(listId, null))

      moveTasks({
        changes: [
          // A subtask moved on its own becomes a top-level task there, with no cadence.
          { id, patch: { listId, parentId: null, position, cadence: null } },
          ...(task.parentId === null
            ? subtasksOf(id).map((subtask) => ({ id: subtask.clientId, patch: { listId } }))
            : []),
        ],
      })
      keepTurns([task.parentId])
    },

    /**
     * Puts a task where it was dropped among its open siblings, from the order the list showed.
     */
    reorderTask(id: string, order: string[]) {
      const task = tasks.get(id)

      if (!task) return
      const changes = placeInOrder(openSiblings(task.listId, task.parentId), order, id)

      if (changes.length === 0) return

      moveTasks({
        changes: changes.map((change) => ({
          id: change.id,
          patch: { position: change.position },
        })),
      })
      keepTurns([task.parentId])
    },

    /**
     * Makes a top-level task a subtask of the task above it, its own subtasks following; they
     * come every time under it until a cadence is chosen there.
     */
    indent(id: string, under: string) {
      const task = tasks.get(id)
      const parent = tasks.get(under)

      if (!task || !parent || task.parentId !== null || parent.parentId !== null || id === under)
        return
      const children = subtasksOf(id)
      let position = bottomPosition(openSiblings(parent.listId, under))

      moveTasks({
        changes: [task, ...children].map((row) => ({
          id: row.clientId,
          patch: { parentId: under, listId: parent.listId, position: position++, cadence: null },
        })),
      })
      keepTurns([under])
    },
  }
}

export type Actions = ReturnType<typeof createActions>
