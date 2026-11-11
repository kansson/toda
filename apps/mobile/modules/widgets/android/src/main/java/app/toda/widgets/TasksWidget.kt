package app.toda.widgets

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.components.CircleIconButton
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.color.DynamicThemeColorProviders
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle

/**
 * The list widget: Today, Starred or a list in a sort, chosen as it is placed
 * (`TasksWidgetConfigureActivity`) and changed by reconfiguring it, under its title with its open
 * tasks as cards. A task's check box
 * completes it right away, without opening the app, unless it is a late repeating task, which
 * asks in the app which day it was done; + adds a task to it; a tap anywhere else
 * opens the app as its icon does. Every colour is a dynamic Material 3 role from the wallpaper,
 * light or dark with the system.
 */
class TasksWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Exact

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val widgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)
    val today = todayState()

    provideContent {
      GlanceTheme(DynamicThemeColorProviders) {
        val snapshot by snapshotState(context).collectAsState()
        val choices by choiceState(context).collectAsState()
        val date by today.collectAsState()
        val choice = choices[widgetId] ?: WidgetChoice()
        val source = snapshot.source(choice.source)
        TasksContent(snapshot, source, source?.tasksIn(choice.sort).orEmpty(), date)
      }
    }
  }
}

@Composable
private fun TasksContent(
  snapshot: WidgetSnapshot,
  source: WidgetSource?,
  tasks: List<WidgetTask>,
  today: String,
) {
  val context = LocalContext.current
  val colors = GlanceTheme.colors
  // Anywhere but a check box or + opens the app as its icon does, where it was left.
  val openApp = actionStartActivity(openIntent(context, ""))

  // The card and, inside it, all that the card holds. The card is the widget's background view
  // alone, its colour on the view itself: the launcher opens and closes the app from a copy of
  // that view, and a tap or a drawable on it makes Glance wrap it, drawing the colour in a child
  // the copy leaves out, so the wallpaper showed through. What it holds opens the app wherever a
  // tap lands on nothing of its own, with one ripple across the card; the list runs edge to edge,
  // so a row's ripple reaches the card's sides.
  Box(
    modifier = GlanceModifier
      .fillMaxSize()
      .background(colors.widgetBackground)
      .appWidgetBackground()
      .cornerRadius(R.dimen.toda_widget_radius),
  ) {
    Column(modifier = GlanceModifier.fillMaxSize().clickable(openApp)) {
      // The title alone, without TitleBar's leading icon. The + keeps as much room to the top as
      // to the side, and the title is centred on it.
      Row(
        modifier = GlanceModifier.fillMaxWidth().padding(start = 16.dp, top = 12.dp, end = 12.dp, bottom = 4.dp),
        verticalAlignment = Alignment.Vertical.CenterVertically,
      ) {
        Text(
          source?.title.orEmpty(),
          maxLines = 1,
          style = TextStyle(color = colors.onSurface, fontSize = 16.sp, fontWeight = FontWeight.Bold),
          modifier = GlanceModifier.defaultWeight(),
        )
        CircleIconButton(
          imageProvider = ImageProvider(R.drawable.toda_widget_add),
          contentDescription = snapshot.labels.newTask,
          onClick = actionStartActivity(openIntent(context, source?.addLink.orEmpty())),
          // Material's tonal colours, as a filled tonal icon button has them.
          backgroundColor = colors.secondaryContainer,
          contentColor = colors.onSecondaryContainer,
        )
      }
      Box(modifier = GlanceModifier.defaultWeight().fillMaxWidth()) {
        if (tasks.isEmpty()) {
          EmptyTasks(snapshot.labels)
        } else {
          // Tasks that fit stand in a plain column, so the room under them is the card's own and a
          // tap there ripples across all of it; more than fit scroll in a list, which fills the
          // widget. A list would take every tap under its last task rather than pass it on.
          val needed = TITLE_BAR + tasks.fold(0.dp) { sum, task -> sum + rowHeight(task) }

          // Glance draws at most ten children in a column.
          if (tasks.size <= 10 && needed <= LocalSize.current.height) {
            Column(modifier = GlanceModifier.fillMaxWidth()) {
              tasks.forEach { task -> TaskCard(task, snapshot, today) }
            }
          } else {
            LazyColumn(modifier = GlanceModifier.fillMaxSize()) {
              items(tasks, itemId = { task -> task.id.hashCode().toLong() }) { task ->
                TaskCard(task, snapshot, today)
              }
            }
          }
        }
      }
    }
  }
}

/** The title bar: 12 dp above the 48 dp +, and 4 dp below it. */
private val TITLE_BAR = 64.dp

/**
 * A task's height on the widget, at the most: its 48 dp toggle, or its title over its date in
 * 10 dp of room each way, with a second line for a title long enough to wrap, sooner for an
 * indented subtask. Rounded up, so tasks that might not fit go in the scrolling list rather than
 * lose their last row.
 */
private fun rowHeight(task: WidgetTask): Dp {
  val title = if (task.title.length > (if (task.isSubtask) 22 else 26)) 44 else 22
  val due = if (task.due.isEmpty()) 0 else 18

  return maxOf(48, 20 + title + due).dp
}

/** How far a subtask is drawn in under its task, as the app's list draws it. */
private val SUBTASK_INDENT = 32.dp

/**
 * One task on the widget's own background: a round toggle that completes it, its title over when
 * it is due, and a star when it has one; a subtask is drawn in under its task. A tap anywhere else opens its page in the app. A
 * repeating task whose date has passed before `today` cannot be completed here: which day it was
 * done decides when it comes back, so its toggle opens the app to ask.
 */
@Composable
private fun TaskCard(task: WidgetTask, snapshot: WidgetSnapshot, today: String) {
  val context = LocalContext.current
  val colors = GlanceTheme.colors
  val labels = snapshot.labels
  // The task's page in the app, or the app itself before it has said how to reach one.
  val link = if (snapshot.taskLink.isEmpty()) "" else snapshot.taskLink + Uri.encode(task.id)
  val openTask = actionStartActivity(openIntent(context, link))
  val check = if (snapshot.doneLink.isNotEmpty() && task.asksDoneDay(today)) {
    actionStartActivity(openIntent(context, snapshot.doneLink + Uri.encode(task.id)))
  } else {
    actionRunCallback<CompleteTaskAction>(actionParametersOf(TASK_ID to task.id))
  }

  Row(
    modifier = GlanceModifier
      .fillMaxWidth()
      .clickable(openTask)
      .padding(start = if (task.isSubtask) 8.dp + SUBTASK_INDENT else 8.dp, end = 20.dp),
    verticalAlignment = Alignment.Vertical.CenterVertically,
  ) {
    // The toggle's own 48 dp target, the circle centred in it, with a round ripple as the app's.
    Box(
      modifier = GlanceModifier
        .size(48.dp)
        .clickable(
          rippleOverride = R.drawable.toda_widget_check_ripple,
          onClick = check,
        )
        .semantics { contentDescription = "${labels.complete}: ${task.title}" },
      contentAlignment = Alignment.Center,
    ) {
      Image(
        provider = ImageProvider(R.drawable.toda_widget_circle),
        contentDescription = null,
        colorFilter = ColorFilter.tint(colors.onSurfaceVariant),
        modifier = GlanceModifier.size(24.dp),
      )
    }
    Column(
      modifier = GlanceModifier.defaultWeight().padding(start = 8.dp, top = 10.dp, bottom = 10.dp),
      verticalAlignment = Alignment.Vertical.CenterVertically,
    ) {
      Text(
        task.title,
        maxLines = 2,
        style = TextStyle(color = colors.onSurface, fontSize = 15.sp, fontWeight = FontWeight.Normal),
      )
      if (task.due.isNotEmpty()) {
        Text(
          task.due,
          maxLines = 1,
          style = TextStyle(
            color = if (task.overdue) colors.error else colors.onSurfaceVariant,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
          ),
        )
      }
    }
    if (task.starred) {
      Image(
        provider = ImageProvider(R.drawable.toda_widget_star),
        contentDescription = null,
        colorFilter = ColorFilter.tint(colors.tertiary),
        modifier = GlanceModifier.size(18.dp),
      )
    }
  }
}

/**
 * Nothing open: the done glyph over No tasks, as the app says it, centred in the room under the
 * title row, so the widget reads as done, not broken.
 */
@Composable
private fun EmptyTasks(labels: WidgetLabels) {
  val colors = GlanceTheme.colors

  Box(modifier = GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.Horizontal.CenterHorizontally) {
      Image(
        provider = ImageProvider(R.drawable.toda_widget_done),
        contentDescription = null,
        colorFilter = ColorFilter.tint(colors.onSurfaceVariant),
        modifier = GlanceModifier.size(40.dp),
      )
      Spacer(GlanceModifier.height(8.dp))
      Text(
        labels.emptyTitle,
        maxLines = 2,
        style = TextStyle(
          color = colors.onSurface,
          fontSize = 16.sp,
          fontWeight = FontWeight.Medium,
          textAlign = TextAlign.Center,
        ),
      )
    }
  }
}

private val TASK_ID = ActionParameters.Key<String>("taskId")

/**
 * A task checked off in the widget, any but a late repeating one: it leaves every widget at once, and the app completes it,
 * with its repeat and its sync, the moment it runs; while it runs, at once. It counts as done when
 * it was checked off, so one taken after midnight still counts the day before.
 */
class CompleteTaskAction : ActionCallback {
  override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
    val taskId = parameters[TASK_ID] ?: return

    recordCompletion(context, taskId, System.currentTimeMillis())
    TasksWidget().updateAll(context)
    WidgetEvents.completed?.invoke()
  }
}

class TasksWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = TasksWidget()

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    forgetSources(context, appWidgetIds)
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    scheduleDayChange(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    cancelDayChange(context)
  }
}
