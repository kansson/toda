import { eq } from '@tanstack/db'
import { useLiveQuery } from '@tanstack/react-db'
import { useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { localDate } from '@/tasks/dates'
import { type List, type Task } from '@/tasks/model'
import { useData } from './provider'

/**
 * Today's date, moving on at midnight and when the app returns to the foreground on a new day,
 * so sections like Today and Overdue are never a day behind.
 */
export function useToday() {
  const [today, setToday] = useState(() => localDate())

  useEffect(() => {
    const update = () => setToday(localDate())
    const midnight = new Date()
    midnight.setHours(24, 0, 1, 0)
    const timer = setTimeout(update, midnight.getTime() - Date.now())

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update()
    })

    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [today])

  return today
}

/** Every list, in the user's order; there may be none, as a task needs no list. */
export function useLists(): List[] {
  const { db } = useData()

  const { data } = useLiveQuery({
    queryKey: ['lists'],
    query: (q) => q.from({ list: db.lists }).orderBy(({ list }) => list.position, 'asc'),
  })

  return useMemo(() => {
    const lists = (data ?? [])
      .slice()
      .sort(
        (a, b) =>
          a.position - b.position ||
          a.createdAt - b.createdAt ||
          a.clientId.localeCompare(b.clientId),
      )

    return lists
  }, [data])
}

/** Every task of every list; screens filter and sort them with `@/tasks/views`. */
export function useAllTasks(): Task[] {
  return useTaskSet().tasks
}

/**
 * Every task, and whether the phone's copy has loaded yet. Screens that switch between views
 * filter this one set rather than starting a query of their own, so a switch shows its tasks at
 * once instead of an empty view while a new query loads.
 */
export function useTaskSet() {
  const { db } = useData()

  const { data, isReady } = useLiveQuery({
    queryKey: ['tasks'],
    query: (q) => q.from({ task: db.tasks }),
  })

  const tasks: Task[] = data ?? []

  return { tasks, loaded: isReady || tasks.length > 0 }
}

/** One task and its subtasks, or undefined once it is gone. */
export function useTask(id: string) {
  const { db } = useData()

  const { data: task } = useLiveQuery({
    queryKey: ['task', id],
    query: (q) =>
      q
        .from({ task: db.tasks })
        .where(({ task }) => eq(task.clientId, id))
        .findOne(),
  })

  const { data: subtasks } = useLiveQuery({
    queryKey: ['tasks', 'subtasks', id],
    query: (q) =>
      q
        .from({ task: db.tasks })
        .where(({ task }) => eq(task.parentId, id))
        .orderBy(({ task }) => task.position, 'asc'),
  })

  return { task, subtasks: subtasks ?? [] }
}

/** Writes made on the phone that the server has not confirmed yet. */
export function usePendingWrites() {
  const { db } = useData()
  const [count, setCount] = useState(() => db.executor.getPendingCount())

  useEffect(() => {
    const update = () => setCount(db.executor.getPendingCount())
    const timer = setInterval(update, 2000)
    update()

    return () => clearInterval(timer)
  }, [db])

  return count
}
