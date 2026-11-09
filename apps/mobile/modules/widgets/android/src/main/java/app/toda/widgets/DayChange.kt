package app.toda.widgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.updateAll
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

private val today = MutableStateFlow(localToday())

/** The shortest window an inexact alarm is given, in milliseconds. */
private const val DAY_CHANGE_WINDOW = 10 * 60 * 1000L

/** The phone's date as the app writes a task's, `YYYY-MM-DD`. */
private fun localToday(): String = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())

/**
 * Today's date for the list widgets, brought up to date as one is drawn and just after midnight,
 * so a repeating task whose day has passed asks in the app which day it was done even though the
 * app has not run since to write the widgets again.
 */
internal fun todayState(): StateFlow<String> {
  today.value = localToday()

  return today
}

private fun dayChangeIntent(context: Context) =
  PendingIntent.getBroadcast(
    context,
    0,
    Intent(context, DayChangeReceiver::class.java),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

/**
 * Redraws the list widgets once the next day has begun, within the ten minutes after midnight
 * the system allows without exact alarms. It does not wake the phone, since a widget is seen only
 * with the screen on. Setting it again replaces it.
 */
internal fun scheduleDayChange(context: Context) {
  val alarms = context.getSystemService(AlarmManager::class.java) ?: return
  val midnight = Calendar.getInstance().apply {
    add(Calendar.DAY_OF_YEAR, 1)
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }

  alarms.setWindow(AlarmManager.RTC, midnight.timeInMillis, DAY_CHANGE_WINDOW, dayChangeIntent(context))
}

/** No list widget is left to redraw. */
internal fun cancelDayChange(context: Context) {
  context.getSystemService(AlarmManager::class.java)?.cancel(dayChangeIntent(context))
}

/** The day has changed: the list widgets are drawn for it, and the next midnight is set. */
class DayChangeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()

    CoroutineScope(Dispatchers.Default).launch {
      try {
        todayState()
        TasksWidget().updateAll(context)
      } finally {
        scheduleDayChange(context)
        pending.finish()
      }
    }
  }
}
