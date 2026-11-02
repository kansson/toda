package app.toda.widgets

import android.content.Context
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject

private const val PREFERENCES = "toda-widgets"
private const val SNAPSHOT_KEY = "snapshot"
private const val COMPLETED_KEY = "completed"
private const val SOURCE_PREFIX = "source-"

/** What a list widget shows unless it was given another: the first list. */
internal const val DEFAULT_SOURCE = "default"

/** A task as the list widget shows it, worded by the app. */
internal data class WidgetTask(
  val id: String,
  val title: String,
  /** When it is due, such as "Today, 14:00"; empty for none. */
  val due: String,
  val overdue: Boolean,
  val starred: Boolean,
)

/** The text the widgets show, in the app's language. */
internal data class WidgetLabels(
  val emptyTitle: String,
  val newTask: String,
  val complete: String,
)

/** What one list widget can show: Today, Starred or a list, with its open tasks. */
internal data class WidgetSource(
  /** `today`, `starred` or the list's id. */
  val key: String,
  val title: String,
  /** Opens a new task in it. */
  val addLink: String,
  val tasks: List<WidgetTask>,
)

/** Everything the widgets draw, as the app last wrote it. */
internal data class WidgetSnapshot(
  val newTaskLink: String,
  /** A task's page, with the task's id after it; empty opens the app instead. */
  val taskLink: String,
  val labels: WidgetLabels,
  /** Today, Starred and every list, in the order the app shows them. */
  val sources: List<WidgetSource>,
) {
  /** The source a widget was given, or the first list if it is gone or was never chosen. */
  fun source(key: String?): WidgetSource? =
    sources.firstOrNull { it.key == key }
      ?: sources.firstOrNull { it.key == DEFAULT_SOURCE }
      ?: sources.firstOrNull()

  fun without(taskIds: Set<String>) =
    copy(sources = sources.map { source -> source.copy(tasks = source.tasks.filterNot { it.id in taskIds }) })
}

private fun preferences(context: Context) =
  context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

private var shown: MutableStateFlow<WidgetSnapshot>? = null
private var chosen: MutableStateFlow<Map<Int, String>>? = null

/**
 * What the widgets draw. A widget whose session is still open, as it is just after a tap, only
 * redraws for state it reads, so every write goes through here as well as to the preferences.
 */
@Synchronized
internal fun snapshotState(context: Context): StateFlow<WidgetSnapshot> =
  shown ?: MutableStateFlow(loadSnapshot(context)).also { shown = it }

/** Each list widget's source by its id, chosen as it was placed or since. */
@Synchronized
internal fun choiceState(context: Context): StateFlow<Map<Int, String>> =
  chosen ?: MutableStateFlow(loadChoices(context)).also { chosen = it }

private fun show(context: Context, snapshot: WidgetSnapshot) {
  (snapshotState(context) as MutableStateFlow).value = snapshot
}

/**
 * Keeps what the app sent, leaving out tasks checked off in a widget that the app has not
 * completed yet, so a snapshot written in between never brings them back.
 */
@Synchronized
internal fun storeSnapshot(context: Context, json: String) {
  val visible = parseSnapshot(JSONObject(json)).without(pendingCompletions(context))

  preferences(context).edit().putString(SNAPSHOT_KEY, encodeSnapshot(visible).toString()).apply()
  show(context, visible)
}

private fun loadSnapshot(context: Context): WidgetSnapshot =
  runCatching {
    preferences(context).getString(SNAPSHOT_KEY, null)?.let { parseSnapshot(JSONObject(it)) }
  }.getOrNull() ?: fallbackSnapshot(context)

/** Gives the list widget `widgetId` its source. */
@Synchronized
internal fun chooseSource(context: Context, widgetId: Int, key: String) {
  preferences(context).edit().putString("$SOURCE_PREFIX$widgetId", key).apply()
  (choiceState(context) as MutableStateFlow).value = choiceState(context).value + (widgetId to key)
}

/** Forgets the sources of widgets taken off the home screen. */
@Synchronized
internal fun forgetSources(context: Context, widgetIds: IntArray) {
  val editor = preferences(context).edit()
  widgetIds.forEach { editor.remove("$SOURCE_PREFIX$it") }
  editor.apply()
  (choiceState(context) as MutableStateFlow).value = choiceState(context).value - widgetIds.toSet()
}

private fun loadChoices(context: Context): Map<Int, String> =
  preferences(context).all.mapNotNull { (key, value) ->
    val id = key.removePrefix(SOURCE_PREFIX).toIntOrNull()
    if (key.startsWith(SOURCE_PREFIX) && id != null && value is String) id to value else null
  }.toMap()

/** A task checked off in a widget: hidden there at once, completed by the app when it runs. */
@Synchronized
internal fun recordCompletion(context: Context, taskId: String) {
  val prefs = preferences(context)
  val pending = pendingCompletions(context) + taskId
  val visible = snapshotState(context).value.without(setOf(taskId))

  prefs.edit()
    .putStringSet(COMPLETED_KEY, pending)
    .putString(SNAPSHOT_KEY, encodeSnapshot(visible).toString())
    .apply()
  show(context, visible)
}

/** The tasks checked off in widgets since the app last took them, once. */
@Synchronized
internal fun takePendingCompletions(context: Context): List<String> {
  val pending = pendingCompletions(context)
  preferences(context).edit().remove(COMPLETED_KEY).apply()

  return pending.toList()
}

private fun pendingCompletions(context: Context): Set<String> =
  preferences(context).getStringSet(COMPLETED_KEY, emptySet())?.toSet() ?: emptySet()

private fun parseTask(task: JSONObject) = WidgetTask(
  id = task.optString("id"),
  title = task.optString("title"),
  due = task.optString("due"),
  overdue = task.optBoolean("overdue"),
  starred = task.optBoolean("starred"),
)

private fun parseSnapshot(root: JSONObject): WidgetSnapshot {
  val labels = root.optJSONObject("labels") ?: JSONObject()
  val sources = root.optJSONArray("sources") ?: JSONArray()

  return WidgetSnapshot(
    newTaskLink = root.optString("newTaskLink"),
    taskLink = root.optString("taskLink"),
    labels = WidgetLabels(
      emptyTitle = labels.optString("emptyTitle"),
      newTask = labels.optString("newTask"),
      complete = labels.optString("complete"),
    ),
    sources = List(sources.length()) { index ->
      val source = sources.getJSONObject(index)
      val tasks = source.optJSONArray("tasks") ?: JSONArray()
      WidgetSource(
        key = source.optString("key"),
        title = source.optString("title"),
        addLink = source.optString("addLink"),
        tasks = List(tasks.length()) { parseTask(tasks.getJSONObject(it)) },
      )
    },
  )
}

private fun encodeSnapshot(snapshot: WidgetSnapshot): JSONObject {
  val sources = JSONArray()

  snapshot.sources.forEach { source ->
    val tasks = JSONArray()
    source.tasks.forEach { task ->
      tasks.put(
        JSONObject()
          .put("id", task.id)
          .put("title", task.title)
          .put("due", task.due)
          .put("overdue", task.overdue)
          .put("starred", task.starred)
      )
    }
    sources.put(
      JSONObject()
        .put("key", source.key)
        .put("title", source.title)
        .put("addLink", source.addLink)
        .put("tasks", tasks)
    )
  }

  return JSONObject()
    .put("newTaskLink", snapshot.newTaskLink)
    .put("taskLink", snapshot.taskLink)
    .put(
      "labels",
      JSONObject()
        .put("emptyTitle", snapshot.labels.emptyTitle)
        .put("newTask", snapshot.labels.newTask)
        .put("complete", snapshot.labels.complete)
    )
    .put("sources", sources)
}

/**
 * Before the app has written anything: the widget's own strings, Today, Starred and the first
 * list with nothing in them, and a tap opens the app.
 */
private fun fallbackSnapshot(context: Context) = WidgetSnapshot(
  newTaskLink = "",
  taskLink = "",
  labels = WidgetLabels(
    emptyTitle = context.getString(R.string.toda_widget_empty_title),
    newTask = context.getString(R.string.toda_widget_new_task),
    complete = context.getString(R.string.toda_widget_complete),
  ),
  sources = listOf(
    WidgetSource("today", context.getString(R.string.toda_widget_today), "", emptyList()),
    WidgetSource("starred", context.getString(R.string.toda_widget_starred), "", emptyList()),
    WidgetSource(DEFAULT_SOURCE, context.getString(R.string.toda_widget_preview_list), "", emptyList()),
  ),
)

/**
 * Opens a link in this app, or for a blank one the app itself as its launcher icon does: brought
 * back where it was left, or started on its main screen.
 */
internal fun openIntent(context: Context, url: String): Intent {
  if (url.isNotBlank()) {
    return Intent(Intent.ACTION_VIEW, Uri.parse(url))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }

  return (
    context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_MAIN).setPackage(context.packageName)
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
}
