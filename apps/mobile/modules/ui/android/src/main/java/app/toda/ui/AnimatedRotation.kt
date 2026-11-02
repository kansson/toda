package app.toda.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.UIComposableScope
import expo.modules.ui.isSlotView

@OptimizedComposeProps
data class AnimatedRotationProps(
  // Turned half a circle, as a chevron pointing the other way. A boolean rather than an angle: a
  // number prop's later values never reached this view inside a ReorderList, a boolean's do.
  val turned: Boolean = false
) : ComposeProps

/**
 * Turns what it holds, such as a section's chevron, half a circle with Material's spatial motion
 * whenever `turned` changes, rather than jumping there.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FunctionalComposableScope.AnimatedRotationContent(props: AnimatedRotationProps) {
  val angle by animateFloatAsState(
    if (props.turned) 180f else 0f,
    MaterialTheme.motionScheme.defaultSpatialSpec(),
    label = "rotation"
  )

  Box(Modifier.graphicsLayer { rotationZ = angle }) {
    Children(UIComposableScope(boxScope = this), filter = { !isSlotView(it) })
  }
}
