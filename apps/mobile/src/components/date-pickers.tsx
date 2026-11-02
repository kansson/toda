import { useLingui } from '@lingui/react/macro'
import { DatePickerDialog, TimePickerDialog } from '@/lib/compose-ui'
import { type CalendarDate, localDate, momentOf, pickedDate, pickerDate } from '@/tasks/dates'
import { uses24HourClock } from '@/ui/format'

/** The Material date picker, opening at `value` or today, for a calendar date. */
export function DatePicker({
  value,
  onPick,
  onDismiss,
}: {
  value: CalendarDate | null
  onPick: (date: CalendarDate) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()

  return (
    <DatePickerDialog
      initialDate={pickerDate(value ?? localDate())}
      confirmButtonLabel={t({ message: 'OK', comment: 'Confirms a picked date' })}
      dismissButtonLabel={t({ message: 'Cancel', comment: 'Closes a dialog without changes' })}
      onDateSelected={(date) => {
        onPick(pickedDate(date))
        onDismiss()
      }}
      onDismissRequest={onDismiss}
    />
  )
}

/** The Material time picker, in the phone's 12- or 24-hour style, for an `HH:MM` time. */
export function TimePicker({
  value,
  onPick,
  onDismiss,
}: {
  value: string | null
  onPick: (time: string) => void
  onDismiss: () => void
}) {
  const { t } = useLingui()
  const opening = value ? momentOf(localDate(), value) : nextHour()

  return (
    <TimePickerDialog
      initialDate={opening.toISOString()}
      is24Hour={uses24HourClock() ?? true}
      confirmButtonLabel={t({ message: 'OK', comment: 'Confirms a picked time' })}
      dismissButtonLabel={t({ message: 'Cancel', comment: 'Closes a dialog without changes' })}
      onDateSelected={(date) => {
        onPick(
          `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
        )
        onDismiss()
      }}
      onDismissRequest={onDismiss}
    />
  )
}

function nextHour() {
  const date = new Date()
  date.setHours(date.getHours() + 1, 0, 0, 0)

  return date
}
