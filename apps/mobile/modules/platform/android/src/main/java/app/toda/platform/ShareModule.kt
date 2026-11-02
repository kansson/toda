package app.toda.platform

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Text another app shares with Toda, which becomes a new task: kept until the app takes it, both
 * when sharing starts the app and when it reaches the running app. It stays on the definition DSL
 * for its activity lifecycle hooks.
 */
class ShareModule : Module() {
  private var pending: Map<String, String?>? = null

  override fun definition() = ModuleDefinition {
    Name("TodaShare")

    Events("onShare")

    OnCreate {
      appContext.currentActivity?.intent?.let { receive(it, notify = false) }
    }

    OnNewIntent { intent ->
      receive(intent, notify = true)
    }

    /** The text shared since it was last taken, once, or null. */
    Function("takeShared") {
      val shared = pending
      pending = null
      shared
    }
  }

  private fun receive(intent: Intent, notify: Boolean) {
    if (intent.action != Intent.ACTION_SEND || intent.type?.startsWith("text/") != true) return

    pending = mapOf(
      "text" to intent.getStringExtra(Intent.EXTRA_TEXT),
      "subject" to (intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: intent.getStringExtra(Intent.EXTRA_TITLE))
    )
    // Read once: a configuration change re-delivers the activity's intent.
    intent.action = null

    if (notify) sendEvent("onShare", mapOf())
  }
}
