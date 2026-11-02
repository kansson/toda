import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

export type FeedbackAction = { label: string; run: () => void }

export type AppFeedback = {
  id: number
  message: string
  action: FeedbackAction | null
}

type FeedbackContextValue = {
  feedback: AppFeedback | null
  clearFeedback: (id: number) => void
  showFeedback: (message: string, action?: FeedbackAction) => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

/**
 * Short confirmations and failures, shown as a snackbar by the visible screen's Scaffold, with an
 * action such as Undo where the change can be taken back.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<AppFeedback | null>(null)

  const showFeedback = useCallback((message: string, action?: FeedbackAction) => {
    setFeedback({ id: Date.now(), message, action: action ?? null })
  }, [])

  const clearFeedback = useCallback((id: number) => {
    setFeedback((current) => (current?.id === id ? null : current))
  }, [])

  const value = useMemo(
    () => ({ clearFeedback, feedback, showFeedback }),
    [clearFeedback, feedback, showFeedback],
  )

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>
}

export function useFeedback() {
  const context = useContext(FeedbackContext)

  if (!context) throw new Error('Feedback is not available')

  return context
}
