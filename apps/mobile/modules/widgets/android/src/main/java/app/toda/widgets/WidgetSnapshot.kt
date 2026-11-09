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
/** Tasks checked off before the moment was kept with them; the app takes them as done now. */
private const val LEGACY_COMPLETED_KEY = "completed"
/** Tasks checked off and not yet taken, with the moment each was checked off. */
private const val COMPLETED_KEY = "completed-at"
private const val TAKEN_KEY = "taken"
private const val ROUND_KEY = "taken-round"
private const val SOURCE_PREFIX = "source-"
private const val SORT_PREFIX = "sort-"

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
  /**
   * A repeating task's date (`YYYY-MM-DD`), empty for any other: once it has passed, its check
   * box asks in the app which day it was done.
   */
  val asksAfter: String,
) {
  /** Whether checking it off on `today` (`YYYY-MM-DD`) asks in the app which day it was done. */
  fun asksDoneDay(today: String) = asksAfter.isNotEmpty() && asksAfter < today
}

/** A sort a widget can be given, named as the app's sort sheet names it. */
internal data class WidgetSort(val key: String, val label: String)

/** The text the widgets show, in the app's language. */
internal data class WidgetLabels(
  val emptyTitle: String,
  val newTask: String,
  val complete: String,
  /** Every sort, in the app's order. */
  val sorts: List<WidgetSort>,
)

/** What one list widget can show: Today, Starred or a list, with its open tasks. */
internal data class WidgetSource(
  /** `today`, `starred` or the list's id. */
  val key: String,
  val title: String,
  /** Opens a new task in it. */
  val addLink: String,
  /** The sort it shows in until a widget is given one: the list's own, or My order. */
  val sort: String,
  /** Its tasks, each once, in [sort]'s order and then those only another sort shows. */
  val tasks: List<WidgetTask>,
  /** Every sort's tasks, by id, in that sort's order. */
  val orders: Map<String, List<String>>,
) {
  /** Its tasks in `sort`, or its own sort for none; as they came for a snapshot without orders. */
  fun tasksIn(sort: String?): List<WidgetTask> {
    val order = orders[sort ?: this.sort] ?: orders[this.sort] ?: return tasks
    val byId = tasks.associateBy { it.id }

    return order.mapNotNull { byId[it] }
  }
}

/** What a list widget shows: its source, and its sort where it was given one. */
internal data class WidgetChoice(val source: String? = null, val sort: String? = null)

/** Everything the widgets draw, as the app last wrote it. */
internal data class WidgetSnapshot(
  val newTaskLink: String,
  /** A task's page, with the task's id after it; empty opens the app instead. */
  val taskLink: String,
  /** Asks in the app which day a late repeating task was done, with its id after it; empty for none. */
  val doneLink: String,
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
    copy(
      sources = sources.map { source ->
        source.copy(
          tasks = source.tasks.filterNot { it.id in taskIds },
          orders = source.orders.mapValues { (_, ids) -> ids.filterNot { it in taskIds } },
        )
      },
    )
}

private fun preferences(context: Context) =
  context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

private var shown: MutableStateFlow<WidgetSnapshot>? = null
private var chosen: MutableStateFlow<Map<Int, WidgetChoice>>? = null

/**
 * What the widgets draw. A widget whose session is still open, as it is just after a tap, only
 * redraws for state it reads, so every write goes through here as well as to the preferences.
 */
@Synchronized
internal fun snapshotState(context: Context): StateFlow<WidgetSnapshot> =
  shown ?: MutableStateFlow(loadSnapshot(context)).also { shown = it }

/** Each list widget's source and sort by its id, chosen as it was placed or since. */
@Synchronized
internal fun choiceState(context: Context): StateFlow<Map<Int, WidgetChoice>> =
  chosen ?: MutableStateFlow(loadChoices(context)).also { chosen = it }

private fun show(context: Context, snapshot: WidgetSnapshot) {
  (snapshotState(context) as MutableStateFlow).value = snapshot
}

/**
 * Keeps what the app sent, leaving out tasks checked off in a widget that the app has not
 * completed yet, so a snapshot written in between never brings them back. That holds for those
 * the app has taken too, until it sends a snapshot built once it had completed them: one built
 * before, but written after, still shows them open. `completedRound` in the JSON is the last
 * round of [takePendingCompletions] the app had completed as it built the snapshot.
 */
@Synchronized
internal fun storeSnapshot(context: Context, json: String) {
  val root = JSONObject(json)
  val completedRound = root.optInt("completedRound", -1)
  val taken = takenCompletions(context).filterValues { it > completedRound }
  val visible = parseSnapshot(root).without(pendingCompletions(context).keys + taken.keys)

  preferences(context).edit()
    .putString(SNAPSHOT_KEY, encodeSnapshot(visible).toString())
    .putString(TAKEN_KEY, encodeTaken(taken))
    .apply()
  show(context, visible)
}

private fun loadSnapshot(context: Context): WidgetSnapshot =
  runCatching {
    preferences(context).getString(SNAPSHOT_KEY, null)?.let { parseSnapshot(JSONObject(it)) }
  }.getOrNull() ?: fallbackSnapshot(context)

/**
 * Gives the list widget `widgetId` its source and sort; with no sort it shows the source's own,
 * following the list's sort in the app.
 */
@Synchronized
internal fun chooseSource(context: Context, widgetId: Int, key: String, sort: String? = null) {
  val editor = preferences(context).edit().putString("$SOURCE_PREFIX$widgetId", key)
  if (sort == null) editor.remove("$SORT_PREFIX$widgetId") else editor.putString("$SORT_PREFIX$widgetId", sort)
  editor.apply()
  (choiceState(context) as MutableStateFlow).value =
    choiceState(context).value + (widgetId to WidgetChoice(key, sort))
}

/** Forgets the sources and sorts of widgets taken off the home screen. */
@Synchronized
internal fun forgetSources(context: Context, widgetIds: IntArray) {
  val editor = preferences(context).edit()
  widgetIds.forEach {
    editor.remove("$SOURCE_PREFIX$it")
    editor.remove("$SORT_PREFIX$it")
  }
  editor.apply()
  (choiceState(context) as MutableStateFlow).value = choiceState(context).value - widgetIds.toSet()
}

private fun loadChoices(context: Context): Map<Int, WidgetChoice> {
  val stored = preferences(context).all
  val chosen = { prefix: String ->
    stored.mapNotNull { (key, value) ->
      val id = key.removePrefix(prefix).toIntOrNull()
      if (key.startsWith(prefix) && id != null && value is String) id to value else null
    }.toMap()
  }
  val sources = chosen(SOURCE_PREFIX)
  val sorts = chosen(SORT_PREFIX)

  return (sources.keys + sorts.keys).associateWith { WidgetChoice(sources[it], sorts[it]) }
}

/**
 * A task checked off in a widget at `at` (epoch milliseconds): hidden there at once, completed by
 * the app when it runs, as done at that moment however much later that is.
 */
@Synchronized
internal fun recordCompletion(context: Context, taskId: String, at: Long) {
  val prefs = preferences(context)
  val earlier = pendingCompletions(context)
  val pending = earlier + (taskId to (earlier[taskId] ?: at))
  val visible = snapshotState(context).value.without(setOf(taskId))

  prefs.edit()
    .putString(COMPLETED_KEY, JSONObject(pending).toString())
    .putString(SNAPSHOT_KEY, encodeSnapshot(visible).toString())
    .apply()
  show(context, visible)
}

/**
 * Tasks checked off in widgets, taken by the app in one round, with the moment each was checked
 * off (epoch milliseconds) at the same index.
 */
internal data class TakenCompletions(val taskIds: List<String>, val checkedAt: List<Long>, val round: Int)

/**
 * The tasks checked off in widgets since the app last took them, once, and the round they were
 * taken in. They stay off the widgets until the app sends a snapshot of that round or later.
 */
@Synchronized
internal fun takePendingCompletions(context: Context): TakenCompletions {
  val prefs = preferences(context)
  val pending = pendingCompletions(context)
  val round = prefs.getInt(ROUND_KEY, 0) + if (pending.isEmpty()) 0 else 1
  val taken = takenCompletions(context) + pending.keys.associateWith { round }

  prefs.edit()
    .remove(COMPLETED_KEY)
    .remove(LEGACY_COMPLETED_KEY)
    .putInt(ROUND_KEY, round)
    .putString(TAKEN_KEY, encodeTaken(taken))
    .apply()

  val entries = pending.entries.toList()

  return TakenCompletions(entries.map { it.key }, entries.map { it.value }, round)
}

/**
 * Tasks checked off in widgets and not yet taken, with the moment each was checked off; one
 * stored before moments were kept counts as checked off now.
 */
private fun pendingCompletions(context: Context): Map<String, Long> {
  val prefs = preferences(context)
  val now = System.currentTimeMillis()
  val legacy = prefs.getStringSet(LEGACY_COMPLETED_KEY, emptySet())?.associateWith { now } ?: emptyMap()
  val stored = runCatching {
    val json = JSONObject(prefs.getString(COMPLETED_KEY, null) ?: "{}")
    json.keys().asSequence().associateWith { json.getLong(it) }
  }.getOrDefault(emptyMap())

  return legacy + stored
}

/** Tasks the app has taken but not yet sent a snapshot after completing, by round. */
private fun takenCompletions(context: Context): Map<String, Int> =
  runCatching {
    val stored = JSONObject(preferences(context).getString(TAKEN_KEY, null) ?: "{}")
    stored.keys().asSequence().associateWith { stored.getInt(it) }
  }.getOrDefault(emptyMap())

private fun encodeTaken(taken: Map<String, Int>) = JSONObject(taken).toString()

private fun parseTask(task: JSONObject) = WidgetTask(
  id = task.optString("id"),
  title = task.optString("title"),
  due = task.optString("due"),
  overdue = task.optBoolean("overdue"),
  starred = task.optBoolean("starred"),
  asksAfter = task.optString("asksAfter"),
)

private fun parseOrders(orders: JSONObject?): Map<String, List<String>> {
  if (orders == null) return emptyMap()

  return orders.keys().asSequence().associateWith { sort ->
    val ids = orders.optJSONArray(sort) ?: JSONArray()
    List(ids.length()) { ids.optString(it) }
  }
}

private fun parseSnapshot(root: JSONObject): WidgetSnapshot {
  val labels = root.optJSONObject("labels") ?: JSONObject()
  val sorts = labels.optJSONArray("sorts") ?: JSONArray()
  val sources = root.optJSONArray("sources") ?: JSONArray()

  return WidgetSnapshot(
    newTaskLink = root.optString("newTaskLink"),
    taskLink = root.optString("taskLink"),
    doneLink = root.optString("doneLink"),
    labels = WidgetLabels(
      emptyTitle = labels.optString("emptyTitle"),
      newTask = labels.optString("newTask"),
      complete = labels.optString("complete"),
      sorts = List(sorts.length()) { index ->
        val sort = sorts.getJSONObject(index)
        WidgetSort(key = sort.optString("key"), label = sort.optString("label"))
      },
    ),
    sources = List(sources.length()) { index ->
      val source = sources.getJSONObject(index)
      val tasks = source.optJSONArray("tasks") ?: JSONArray()
      WidgetSource(
        key = source.optString("key"),
        title = source.optString("title"),
        addLink = source.optString("addLink"),
        sort = source.optString("sort", "manual"),
        tasks = List(tasks.length()) { parseTask(tasks.getJSONObject(it)) },
        orders = parseOrders(source.optJSONObject("orders")),
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
          .put("asksAfter", task.asksAfter)
      )
    }
    val orders = JSONObject()
    source.orders.forEach { (sort, ids) -> orders.put(sort, JSONArray(ids)) }
    sources.put(
      JSONObject()
        .put("key", source.key)
        .put("title", source.title)
        .put("addLink", source.addLink)
        .put("sort", source.sort)
        .put("tasks", tasks)
        .put("orders", orders)
    )
  }
  val sorts = JSONArray()
  snapshot.labels.sorts.forEach { sorts.put(JSONObject().put("key", it.key).put("label", it.label)) }

  return JSONObject()
    .put("newTaskLink", snapshot.newTaskLink)
    .put("taskLink", snapshot.taskLink)
    .put("doneLink", snapshot.doneLink)
    .put(
      "labels",
      JSONObject()
        .put("emptyTitle", snapshot.labels.emptyTitle)
        .put("newTask", snapshot.labels.newTask)
        .put("complete", snapshot.labels.complete)
        .put("sorts", sorts)
    )
    .put("sources", sources)
}

/**
 * Before the app has written anything: the widget's own strings, Today, Starred and the first
 * list with nothing in them, the app's sorts, and a tap opens the app.
 */
private fun fallbackSnapshot(context: Context) = WidgetSnapshot(
  newTaskLink = "",
  taskLink = "",
  doneLink = "",
  labels = WidgetLabels(
    emptyTitle = context.getString(R.string.toda_widget_empty_title),
    newTask = context.getString(R.string.toda_widget_new_task),
    complete = context.getString(R.string.toda_widget_complete),
    sorts = listOf(
      WidgetSort("manual", context.getString(R.string.toda_widget_sort_manual)),
      WidgetSort("date", context.getString(R.string.toda_widget_sort_date)),
      WidgetSort("deadline", context.getString(R.string.toda_widget_sort_deadline)),
      WidgetSort("starred", context.getString(R.string.toda_widget_sort_starred)),
      WidgetSort("title", context.getString(R.string.toda_widget_sort_title)),
    ),
  ),
  sources = listOf(
    WidgetSource("today", context.getString(R.string.toda_widget_today), "", "manual", emptyList(), emptyMap()),
    WidgetSource("starred", context.getString(R.string.toda_widget_starred), "", "manual", emptyList(), emptyMap()),
    WidgetSource(DEFAULT_SOURCE, context.getString(R.string.toda_widget_preview_list), "", "manual", emptyList(), emptyMap()),
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
