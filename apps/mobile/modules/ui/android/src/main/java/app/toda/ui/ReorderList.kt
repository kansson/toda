package app.toda.ui

import android.annotation.SuppressLint
import android.content.Context
import android.view.HapticFeedbackConstants
import android.view.View
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableIntState
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.currentRecomposeScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.unit.toSize
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ComposableScope
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.ExpoComposeView
import expo.modules.kotlin.views.OptimizedComposeProps
import sh.calvin.reorderable.DragGestureDetector
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

@OptimizedComposeProps
data class ReorderListProps(
  /** One stable key per child, in the children's order. */
  val keys: MutableState<List<String>> = mutableStateOf(emptyList()),
  /** Which children can be held and dragged; the others, such as headers, stay put. */
  val draggable: MutableState<List<Boolean>> = mutableStateOf(emptyList()),
  val contentPadding: MutableState<GatedListPadding?> = mutableStateOf(null),
  /** Space between items, in dp. */
  val spacing: MutableState<Double> = mutableStateOf(0.0),
  /**
   * The shape items draw themselves in, inset from the list's edges, for items with no background
   * of their own: a held one is tinted in it, with no shadow. Without it a held item is lifted
   * on a shadowed surface as wide as the list.
   */
  val heldTint: MutableState<ReorderHeldTint?> = mutableStateOf(null)
) : ComposeProps

@OptimizedRecord
data class ReorderHeldTint(
  /** From each side of the list, in dp. */
  @Field val inset: Int = 0,
  /** The corners' radius, in dp. */
  @Field val corner: Int = 0
) : Record

@OptimizedRecord
data class ReorderEvent(
  @Field val key: String = "",
  @Field val order: List<String> = emptyList()
) : Record

/**
 * A lazy list, one item per child, whose draggable items are held to pick them up and dropped
 * into a new place, the others making way as it moves. The new order is reported once, on the
 * drop; the list shows it until the next keys arrive, so a drop never jumps back while the app
 * saves it.
 */
@SuppressLint("ViewConstructor")
class ReorderListView(context: Context, appContext: AppContext) :
  ExpoComposeView<ReorderListProps>(context, appContext) {
  override val props = ReorderListProps()

  private val onReorder by EventDispatcher<ReorderEvent>()

  private val childTotal: MutableIntState = mutableIntStateOf(0)

  override fun onViewAdded(child: View?) {
    super.onViewAdded(child)
    childTotal.intValue = childCount
  }

  override fun onViewRemoved(child: View?) {
    super.onViewRemoved(child)
    childTotal.intValue = childCount
  }

  @Composable
  override fun ComposableScope.Content() {
    recomposeScope = currentRecomposeScope
    val keys = props.keys.value
    val draggable = props.draggable.value
    val padding = props.contentPadding.value
    val heldTint = props.heldTint.value
    val count = childTotal.intValue
    val view = LocalView.current
    val list = rememberLazyListState()
    // The order shown: the app's, until a drag moves an item within it.
    var order by remember(keys) { mutableStateOf(keys) }
    val reorder = rememberReorderableLazyListState(list) { from, to ->
      val fromKey = from.key as? String ?: return@rememberReorderableLazyListState
      val toKey = to.key as? String ?: return@rememberReorderableLazyListState
      val fromIndex = order.indexOf(fromKey)
      val toIndex = order.indexOf(toKey)
      if (fromIndex < 0 || toIndex < 0) return@rememberReorderableLazyListState
      order = order.toMutableList().apply { add(toIndex, removeAt(fromIndex)) }
      view.performHapticFeedback(HapticFeedbackConstants.SEGMENT_FREQUENT_TICK)
    }
    val scope = this@Content
    // The part of the list in view, which a dragged item stays within.
    val listBounds = remember { Bounds() }

    LazyColumn(
      state = list,
      modifier = Modifier
        .fillMaxSize()
        .onGloballyPositioned { listBounds.rect = it.boundsInWindow() },
      verticalArrangement = Arrangement.spacedBy(props.spacing.value.dp),
      contentPadding = PaddingValues(
        start = (padding?.start ?: 0).dp,
        top = (padding?.top ?: 0).dp,
        end = (padding?.end ?: 0).dp,
        bottom = (padding?.bottom ?: 0).dp
      )
    ) {
      items(order, key = { it }) { key ->
        val index = keys.indexOf(key)
        val child = if (index in 0..<count) getChildAt(index) as? ExpoComposeView<*> else null
        val canDrag = draggable.getOrNull(index) ?: false

        ReorderableItem(reorder, key = key, enabled = canDrag) { dragging ->
          val itemBounds = remember { Bounds() }
          val handle = if (canDrag) {
            Modifier.draggableHandle(
              onDragStarted = { view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS) },
              onDragStopped = {
                view.performHapticFeedback(HapticFeedbackConstants.GESTURE_END)
                if (order != keys) onReorder(ReorderEvent(key, order))
              },
              dragGestureDetector = remember(itemBounds) { BoundedLongPress(itemBounds, listBounds) }
            )
          } else {
            Modifier
          }

          // Where it is drawn, the drag's offset included, unclipped by the list.
          val placed = handle.onGloballyPositioned {
            itemBounds.rect = Rect(it.positionInWindow(), it.size.toSize())
          }
          val content: @Composable () -> Unit = {
            if (child != null) {
              with(scope) {
                with(child) {
                  Content()
                }
              }
            }
          }

          if (heldTint != null) {
            val tint by animateColorAsState(
              if (dragging) MaterialTheme.colorScheme.surfaceContainerHighest else Color.Transparent,
              label = "drag-tint"
            )

            Box(modifier = placed) {
              Box(
                Modifier
                  .matchParentSize()
                  .padding(horizontal = heldTint.inset.dp)
                  .background(tint, RoundedCornerShape(heldTint.corner.dp))
              )
              content()
            }
          } else {
            val elevation by animateDpAsState(if (dragging) 8.dp else 0.dp, label = "drag-elevation")

            Surface(
              modifier = placed,
              color = if (dragging) MaterialTheme.colorScheme.surfaceContainerHighest else Color.Transparent,
              // Rounded only while lifted: at rest the shape would clip a row's ripple, which runs
              // edge to edge.
              shape = if (dragging) MaterialTheme.shapes.large else RectangleShape,
              shadowElevation = elevation,
              content = content
            )
          }
        }
      }
    }
  }
}

/** Where something is drawn in the window, kept up to date as it lays out and moves. */
private class Bounds {
  var rect: Rect? = null
}

/**
 * Picks an item up on a long press, as the library's own detector does, and keeps it within the
 * part of the list in view as it is dragged: it stops at the list's edges rather than slide under
 * a bar above or past the foot. Held at an edge it is within the library's scroll threshold, so
 * the list scrolls on beneath it to reach items out of view either way.
 */
private class BoundedLongPress(private val item: Bounds, private val list: Bounds) :
  DragGestureDetector {
  override suspend fun PointerInputScope.detect(
    onDragStart: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onDragCancel: () -> Unit,
    onDrag: (PointerInputChange, Offset) -> Unit
  ) {
    detectDragGesturesAfterLongPress(onDragStart, onDragEnd, onDragCancel) { change, amount ->
      val itemRect = item.rect
      val listRect = list.rect
      if (itemRect == null || listRect == null) {
        onDrag(change, amount)
      } else {
        val up = minOf(listRect.top - itemRect.top, 0f)
        val down = maxOf(listRect.bottom - itemRect.bottom, 0f)
        onDrag(change, Offset(amount.x, amount.y.coerceIn(up, down)))
      }
    }
  }
}
