package app.toda.widgets

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/**
 * What a list widget shows, chosen as it is placed and again when it is reconfigured, as Google
 * Tasks asks: Today, Starred or one of the lists, in the app's order and language. Choosing one
 * places the widget; leaving without a choice cancels it.
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
    val current = snapshot.source(choiceState(this).value[widgetId])?.key

    enableEdgeToEdge()
    setContent {
      WidgetTheme {
        ChooseSource(
          sources = snapshot.sources,
          selected = current,
          onClose = { finish() },
          onChoose = { key ->
            chooseSource(this, widgetId, key)
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChooseSource(
  sources: List<WidgetSource>,
  selected: String?,
  onClose: () -> Unit,
  onChoose: (String) -> Unit,
) {
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
      )
    },
  ) { padding ->
    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
      items(sources, key = { it.key }) { source ->
        ListItem(
          headlineContent = { Text(source.title) },
          leadingContent = {
            RadioButton(selected = source.key == selected, onClick = { onChoose(source.key) })
          },
          modifier = Modifier.clickable { onChoose(source.key) },
        )
      }
    }
  }
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
