package app.toda.ui

import android.view.View
import com.facebook.react.ReactActivity
import com.facebook.react.uimanager.UIManagerHelper
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.Record
import io.github.expo.modules.v2.react.currentActivity
import io.github.expo.modules.v2.react.reactContextOrNull
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/** Nothing to say but that it happened, for events that carry no data. */
@Record
class Signal

/**
 * What the screens need of Android beyond their views: Back and its predictive preview, and a
 * closing screen's last frame.
 */
@ExpoModule("TodaUI")
class TodaUIModule : Module() {
  /** A committed back swipe is about to dismiss the top screen natively. */
  @io.github.expo.modules.v2.Event(name = "onNativeDismissal")
  private val onNativeDismissal = event<Signal>()

  init {
    StackBack.onDismissing = { onNativeDismissal(Signal()) }
  }

  override fun onDestroy() {
    StackBack.onDismissing = null
  }

  /**
   * Whether React Native handles Back; off at the root screen, so Android can animate back to the
   * home screen. False while no activity is attached yet, for the caller to try again.
   */
  @JS
  fun setReactNativeBack(enabled: Boolean): Boolean {
    val activity = currentActivity as? ReactActivity ?: return false
    setReactNativeBack(activity, enabled)
    // Stack screens get predictive back wherever React Native would handle Back.
    activity.runOnUiThread {
      StackEnter.register(activity)
      StackBack.of(activity).setWanted(enabled)
    }
    return true
  }

  /** While the app takes Back for itself, a back swipe previews nothing. */
  @JS
  fun setBackPreviewBlocked(blocked: Boolean): Boolean {
    val activity = currentActivity as? ReactActivity ?: return false
    activity.runOnUiThread { StackBack.of(activity).setBlocked(blocked) }
    return true
  }

  /** A closing screen keeps its last frame through the stack's exit transition. */
  @JS
  suspend fun freezeScreen(tag: Int): Boolean = withContext(Dispatchers.Main) {
    val activity = currentActivity
    val view = viewOf(tag)
    if (activity == null || view == null) {
      false
    } else {
      suspendCancellableCoroutine { continuation ->
        ScreenFreeze.freeze(activity, view) { kept -> continuation.resume(kept) }
      }
    }
  }

  /** Takes the kept frame away from a screen that stayed. */
  @JS
  suspend fun thawScreen(tag: Int): Unit = withContext(Dispatchers.Main) {
    viewOf(tag)?.let { ScreenFreeze.thaw(it) }
  }

  /** A predictive back removes its screen natively first; such a screen has nothing to freeze. */
  @JS
  fun takeNativeDismissal(): Boolean = StackBack.takeNativeDismissal()

  /** The view React Native draws for `tag`, on the main thread. */
  private fun viewOf(tag: Int): View? {
    val reactContext = reactContextOrNull ?: return null

    return UIManagerHelper.getUIManagerForReactTag(reactContext, tag)?.resolveView(tag)
  }
}
