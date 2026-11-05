package app.toda.widgets

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/**
 * What a list widget shows, chosen as it is placed and again when it is reconfigured, as Google
 * Tasks asks: Today, Starred or one of the lists, in the app's order and language, and the sort
 * it shows them in. Save places the widget; leaving without saving cancels it.
 */
class TasksWidgetConfigureActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    val widgetId = intent?.extras?.getInt(
      AppWidgetManager.EXTRA_APPWIDGET_ID,
      AppWidgetManager.INVALID_APPWIDGET_ID,
    ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
    val result = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)

    // Backing out leaves no widget behind.
    setResult(RESULT_CANCELED, result)
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) return finish()

    val snapshot = snapshotState(this).value
    val choice = choiceState(this).value[widgetId] ?: WidgetChoice()
    val current = snapshot.source(choice.source)?.key

    enableEdgeToEdge()
    setContent {
      WidgetTheme {
        ChooseSource(
          sources = snapshot.sources,
          sorts = snapshot.labels.sorts,
          selected = current,
          selectedSort = choice.sort,
          onClose = { finish() },
          onSave = { key, sort ->
            chooseSource(this, widgetId, key, sort)
            lifecycleScope.launch {
              val glanceId = GlanceAppWidgetManager(this@TasksWidgetConfigureActivity)
                .getGlanceIdBy(widgetId)
              TasksWidget().update(this@TasksWidgetConfigureActivity, glanceId)
              setResult(RESULT_OK, result)
              finish()
            }
          },
        )
      }
    }
  }
}

/** Material 3 in the wallpaper's colours where Android has them, light or dark with the system. */
@Composable
private fun WidgetTheme(content: @Composable () -> Unit) {
  val context = LocalContext.current
  val dark = isSystemInDarkTheme()
  val scheme = when {
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
      if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    dark -> darkColorScheme()
    else -> lightColorScheme()
  }

  MaterialTheme(colorScheme = scheme, content = content)
}

/**
 * The lists, then the sorts, as Material's full-screen dialog: close to cancel, Save to keep the
 * choice. A widget given no sort shows its source's own, so a list's follows its sort in the app;
 * the one it shows is ticked until another is chosen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChooseSource(
  sources: List<WidgetSource>,
  sorts: List<WidgetSort>,
  selected: String?,
  selectedSort: String?,
  onClose: () -> Unit,
  onSave: (source: String, sort: String?) -> Unit,
) {
  var source by rememberSaveable { mutableStateOf(selected) }
  var sort by rememberSaveable { mutableStateOf(selectedSort) }
  val shownSort = sort ?: sources.firstOrNull { it.key == source }?.sort

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text(stringResource(R.string.toda_widget_choose)) },
        navigationIcon = {
          IconButton(onClick = onClose) {
            Icon(
              painterResource(R.drawable.toda_widget_close),
              contentDescription = stringResource(R.string.toda_widget_cancel),
            )
          }
        },
        actions = {
          TextButton(onClick = { source?.let { onSave(it, sort) } }, enabled = source != null) {
            Text(stringResource(R.string.toda_widget_save))
          }
        },
      )
    },
  ) { padding ->
    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
      items(sources, key = { "source:${it.key}" }) { option ->
        Choice(option.title, option.key == source) { source = option.key }
      }
      item(key = "sorts") {
        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        Text(
          stringResource(R.string.toda_widget_sort_by),
          style = MaterialTheme.typography.titleSmall,
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )
      }
      items(sorts, key = { "sort:${it.key}" }) { option ->
        Choice(option.label, option.key == shownSort) { sort = option.key }
      }
    }
  }
}

/** One choice of a group, a radio button before it; a tap anywhere on the row chooses it. */
@Composable
private fun Choice(label: String, selected: Boolean, onChoose: () -> Unit) {
  ListItem(
    headlineContent = { Text(label) },
    leadingContent = { RadioButton(selected = selected, onClick = null) },
    modifier = Modifier.selectable(selected = selected, role = Role.RadioButton, onClick = onChoose),
  )
}

/** Gives a widget pinned from the app's Settings the source chosen there. */
class PinnedWidgetReceiver : android.content.BroadcastReceiver() {
  override fun onReceive(context: android.content.Context, intent: Intent) {
    val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
    val key = intent.getStringExtra(EXTRA_SOURCE)
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID || key == null) return

    chooseSource(context, widgetId, key)
    val pending = goAsync()
    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Default).launch {
      try {
        TasksWidget().updateAll(context)
      } finally {
        pending.finish()
      }
    }
  }

  companion object {
    const val EXTRA_SOURCE = "app.toda.widgets.SOURCE"
  }
}
