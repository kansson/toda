package app.toda.platform

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.androidContext

/**
 * What the app asks of Android beyond Expo's modules: whether reminders may fire at their exact
 * minute, and the settings that allow it and the app's notifications.
 */
@ExpoModule("TodaDevice")
class DeviceModule : Module() {
  /** Whether alarms may fire at their exact minute; true where Android asks no permission. */
  @JS
  fun canScheduleExactAlarms(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val alarms = androidContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    return alarms.canScheduleExactAlarms()
  }

  /** Opens the system setting that lets the app set exact alarms. */
  @JS
  fun openExactAlarmSettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    open(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${androidContext.packageName}")))
  }

  /** Opens the app's notification settings, with its channels. */
  @JS
  fun openNotificationSettings() {
    open(
      Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, androidContext.packageName)
    )
  }

  private fun open(intent: Intent) {
    androidContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
