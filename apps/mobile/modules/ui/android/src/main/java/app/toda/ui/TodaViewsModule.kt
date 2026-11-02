package app.toda.ui

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView

/**
 * The Compose views Expo UI lacks, on the Expo Modules definition DSL as Expo UI's own views are.
 */
class TodaViewsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TodaViews")

    ExpoUIView<ScaffoldProps>("ScaffoldView") {
      val onSnackbarAction by Event<Unit>()
      val onSnackbarDismiss by Event<Unit>()

      Content { props ->
        ScaffoldContent(props, { onSnackbarAction(Unit) }) { onSnackbarDismiss(Unit) }
      }
    }

    ExpoUIView<AppBarProps>("TopAppBarView") {
      Content { props ->
        TopAppBarContent(props, large = false)
      }
    }

    ExpoUIView<AppBarProps>("LargeTopAppBarView") {
      Content { props ->
        TopAppBarContent(props, large = true)
      }
    }

    ExpoUIView<HeaderAppBarProps>("HeaderAppBarView") {
      Content { props ->
        HeaderAppBarContent(props)
      }
    }

    ExpoUIView<HeaderFieldProps>("HeaderFieldView") {
      Content { props ->
        HeaderFieldContent(props)
      }
    }

    ExpoUIView<AnimatedRotationProps>("AnimatedRotationView") {
      Content { props ->
        AnimatedRotationContent(props)
      }
    }

    ExpoUIView<BodyCentreProps>("BodyCentreView") {
      Content { _ ->
        BodyCentreContent()
      }
    }

    View(GatedListView::class)

    View(ReorderListView::class) {
      Events("onReorder")
    }

    View(SheetListView::class)

    ExpoUIView<ModalSheetProps>("ModalSheetView") {
      val hide by AsyncFunction()
      val onDismissRequest by Event<Unit>()

      Content { props ->
        ModalSheetContent(props, hide) { onDismissRequest(Unit) }
      }
    }

    ExpoUIView<ConnectedButtonGroupProps>("ConnectedButtonGroupView") {
      val onItemPress by Event<ButtonGroupPressEvent>()
      val onItemLongPress by Event<ButtonGroupPressEvent>()

      Content { props ->
        ConnectedButtonGroupContent(
          props,
          { index -> onItemPress(ButtonGroupPressEvent(index)) },
          { index -> onItemLongPress(ButtonGroupPressEvent(index)) }
        )
      }
    }
  }
}
