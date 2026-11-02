package app.toda.widgets

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.DynamicThemeColorProviders
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle

/**
 * One tap to a new task, as the launcher shortcut: the add icon alone when the widget is a
 * single cell, with its label when wider. On the primary container role of the wallpaper.
 */
class NewTaskWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Exact

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    provideContent {
      GlanceTheme(DynamicThemeColorProviders) {
        val snapshot by snapshotState(context).collectAsState()
        NewTaskContent(snapshot)
      }
    }
  }
}

@Composable
private fun NewTaskContent(snapshot: WidgetSnapshot) {
  val context = LocalContext.current
  val colors = GlanceTheme.colors
  val wide = LocalSize.current.width.value >= 140f

  // The card alone is the widget's background view, its colour on the view itself, and the tap
  // sits on what it holds, as in the Tasks widget: the launcher animates the app from a copy of
  // that view, which leaves out a colour Glance moves into a child for a tap.
  Box(
    modifier = GlanceModifier
      .fillMaxSize()
      .background(colors.primaryContainer)
      .appWidgetBackground()
      .cornerRadius(R.dimen.toda_widget_radius),
  ) {
    Box(
      modifier = GlanceModifier
        .fillMaxSize()
        .clickable(actionStartActivity(openIntent(context, snapshot.newTaskLink)))
        .semantics { contentDescription = snapshot.labels.newTask },
      contentAlignment = Alignment.Center,
    ) {
      Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
        Image(
          provider = ImageProvider(R.drawable.toda_widget_add),
          contentDescription = null,
          colorFilter = ColorFilter.tint(colors.onPrimaryContainer),
          modifier = GlanceModifier.size(24.dp),
        )
        if (wide) {
          Spacer(GlanceModifier.width(8.dp))
          Text(
            snapshot.labels.newTask,
            maxLines = 1,
            style = TextStyle(color = colors.onPrimaryContainer, fontSize = 16.sp, fontWeight = FontWeight.Medium),
          )
        }
      }
    }
  }
}

class NewTaskWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = NewTaskWidget()
}
