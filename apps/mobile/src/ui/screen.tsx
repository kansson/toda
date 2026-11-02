import { useLingui } from '@lingui/react/macro'
import { useIsFocused, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Host } from '@/components/host'
import { LeavingFrame } from '@/components/leaving-frame'
import {
  background,
  clip,
  composeGeometry,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  weight,
} from '@/lib/compose-modifiers'
import {
  Box,
  FilledTonalIconButton,
  Icon,
  IconButton,
  Row,
  Text,
  useMaterialColors,
} from '@/lib/compose-ui'
import { useFeedback } from '@/lib/feedback'
import { HeaderAppBar, LargeTopAppBar, Scaffold, TopAppBar } from '../../modules/ui'
import { type Glyph, glyphs } from './glyphs'

export type ActionProps = {
  glyph: Glyph
  label: string
  onPress: () => void
  enabled?: boolean
}

/**
 * An icon button with its accessible label. It sets no colour: in an app bar or list item slot it
 * takes the colour that slot provides. Inside an app bar, guard the handler instead of toggling
 * `enabled`: Expo UI removes a slot's icon button when `enabled` changes.
 */
export function Action({ glyph, label, onPress, enabled = true }: ActionProps) {
  return (
    <IconButton onClick={onPress} enabled={enabled}>
      <Icon source={glyphs[glyph]} size={24} contentDescription={label} />
    </IconButton>
  )
}

function BackAction({ onPress }: { onPress?: () => void }) {
  const { t } = useLingui()
  const router = useRouter()

  return (
    <Action
      glyph='back'
      label={t({ message: 'Back', comment: 'Top bar button returning to the previous screen' })}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
    />
  )
}

/**
 * The title row of a top bar that holds more below it, laid out as Material's small app bar: the
 * way back, the title and the actions, 64 dp tall.
 */
function TitleRow({
  title,
  navigationIcon,
  actions,
}: {
  title: string
  navigationIcon: ReactNode
  actions: ReactNode
}) {
  return (
    <Row
      verticalAlignment='center'
      modifiers={[fillMaxWidth(), height(64), padding(navigationIcon ? 4 : 16, 0, 4, 0)]}
    >
      {navigationIcon}
      <Box modifiers={[weight(1), padding(navigationIcon ? 12 : 0, 0, 0, 0)]}>
        <Text maxLines={1} overflow='ellipsis' style={{ typography: 'titleLarge' }}>
          {title}
        </Text>
      </Box>
      {actions}
    </Row>
  )
}

export type ScreenProps = {
  title: string
  /**
   * Large collapsing bars for top-level destinations, small ones for detail screens, and `header`
   * for a bar made only of the screen's own header, such as a search field.
   */
  appBar?: 'large' | 'small' | 'header'
  /**
   * What the top bar holds below its title row, such as filter chips, or in place of it with
   * `appBar='header'`. All of it slides away while the content scrolls down and returns on the
   * way up, as in vaka and listan.
   */
  header?: ReactNode
  /** A back arrow on pushed screens. */
  navigation?: 'back'
  onNavigate?: () => void
  actions?: ReactNode
  /** The screen's main action, such as adding a task; it stays mounted, empty when unused. */
  floatingAction?: ReactNode
  /**
   * The bar and header on a tinted backdrop over the content's own panel, whose top corners curve
   * down into it, as the main screen has it. The header stays put rather than sliding away.
   */
  panel?: boolean
  children?: ReactNode
}

/**
 * The screen's one main action in its app bar, such as saving a new task: a filled tonal icon
 * button, so it stands apart from the plain actions beside it.
 */
export function PrimaryAction({ glyph, label, onPress, enabled = true }: ActionProps) {
  return (
    <Box modifiers={[padding(4, 0, 8, 0)]}>
      <FilledTonalIconButton enabled={enabled} onClick={onPress}>
        <Icon source={glyphs[glyph]} size={24} contentDescription={label} />
      </FilledTonalIconButton>
    </Box>
  )
}

/**
 * A whole screen in one Compose tree: the Material 3 Scaffold, its app bar, the floating action
 * and the snackbar for feedback, shown while the screen is focused. It keeps its last frame while
 * the stack moves it away (`LeavingFrame`).
 */
export function Screen({
  title,
  appBar = 'small',
  header,
  navigation,
  onNavigate,
  actions,
  floatingAction,
  panel = false,
  children,
}: ScreenProps) {
  const colors = useMaterialColors()
  const focused = useIsFocused()
  const { clearFeedback, feedback } = useFeedback()
  const presented = focused ? feedback : null
  const navigationIcon = navigation ? <BackAction onPress={onNavigate} /> : undefined
  // Always present: actions often appear only once the screen's data has loaded.
  const actionRow = <Row verticalAlignment='center'>{actions}</Row>

  const topBar = header ? (
    <HeaderAppBar containerColor={panel ? colors.surfaceContainer : undefined}>
      {appBar === 'header' ? null : (
        <TitleRow title={title} navigationIcon={navigationIcon} actions={actionRow} />
      )}
      {header}
    </HeaderAppBar>
  ) : appBar === 'large' ? (
    <LargeTopAppBar title={title} navigationIcon={navigationIcon} actions={actionRow} />
  ) : (
    <TopAppBar title={title} navigationIcon={navigationIcon} actions={actionRow} />
  )

  return (
    <LeavingFrame>
      <Host style={{ flex: 1 }}>
        <Scaffold
          topBar={topBar}
          floatingActionButton={floatingAction}
          containerColor={panel ? colors.surfaceContainer : undefined}
          // The panel runs on under the navigation bar; its list keeps room at its foot.
          bottomInset={!panel}
          scrollBehavior={
            header && !panel ? 'enterAlways' : appBar === 'large' ? 'exitUntilCollapsed' : 'pinned'
          }
          snackbarId={presented?.id ?? 0}
          snackbarMessage={presented?.message ?? ''}
          snackbarAction={presented?.action?.label ?? ''}
          onSnackbarAction={presented?.action ? () => presented.action?.run() : undefined}
          onSnackbarDismiss={presented ? () => clearFeedback(presented.id) : undefined}
        >
          {panel ? (
            <Box
              modifiers={[
                fillMaxSize(),
                clip(composeGeometry.RoundedCorner({ topStart: 28, topEnd: 28 })),
                background(colors.surface),
              ]}
            >
              {children}
            </Box>
          ) : (
            children
          )}
        </Scaffold>
      </Host>
    </LeavingFrame>
  )
}
