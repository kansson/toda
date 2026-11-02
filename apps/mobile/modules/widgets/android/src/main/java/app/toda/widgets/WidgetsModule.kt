package app.toda.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import androidx.glance.appwidget.updateAll
import io.github.expo.modules.v2.Event
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.Record
import io.github.expo.modules.v2.react.androidContext

/** Nothing to say but that it happened. */
@Record
class WidgetSignal

/** Reports widget check boxes to a running app; set while the module is loaded. */
internal object WidgetEvents {
  @Volatile var completed: (() -> Unit)? = null
}

/**
 * The app's side of its Glance widgets: it writes what they show, takes what was checked off in
 * them, and asks the launcher to pin one.
 */
@ExpoModule("TodaWidgets")
class WidgetsModule : Module() {
  /** A task was checked off in a widget; `takeCompletions` says which. */
  @Event(name = "onCompleted")
  private val onCompleted = event<WidgetSignal>()

  init {
    WidgetEvents.completed = { onCompleted(WidgetSignal()) }
  }

  override fun onDestroy() {
    WidgetEvents.completed = null
  }

  /** Stores the snapshot (JSON) and redraws every widget. */
  @JS
  suspend fun update(snapshot: String) {
    storeSnapshot(androidContext, snapshot)
    TasksWidget().updateAll(androidContext)
    NewTaskWidget().updateAll(androidContext)
  }

  /** Redraws every widget, as after the system palette changed. */
  @JS
  suspend fun redraw() {
    TasksWidget().updateAll(androidContext)
    NewTaskWidget().updateAll(androidContext)
  }

  /** The ids of tasks checked off in widgets since the last call, once. */
  @JS
  fun takeCompletions(): List<String> = takePendingCompletions(androidContext)

  /**
   * Asks the launcher to add a widget (`tasks` or `newTask`); false where it cannot. A list widget
   * shows `source` (`today`, `starred` or a list's id): the launcher asks nothing of a widget an app
   * pins, so the choice made in the app reaches it through the pin's callback.
   */
  @JS
  fun requestPin(kind: String, source: String?): Boolean {
    val receiver = when (kind) {
      "tasks" -> TasksWidgetReceiver::class.java
      "newTask" -> NewTaskWidgetReceiver::class.java
      else -> return false
    }
    val manager = AppWidgetManager.getInstance(androidContext)
    if (!manager.isRequestPinAppWidgetSupported) return false

    // Mutable, so the launcher can add the new widget's id.
    val callback = source?.let {
      PendingIntent.getBroadcast(
        androidContext,
        0,
        Intent(androidContext, PinnedWidgetReceiver::class.java)
          .putExtra(PinnedWidgetReceiver.EXTRA_SOURCE, it),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
      )
    }

    return manager.requestPinAppWidget(ComponentName(androidContext, receiver), null, callback)
  }
}
