import { requireNativeView } from 'expo'
import type * as React from 'react'
import type { ReactNode, Ref } from 'react'
import type { ColorValue, NativeSyntheticEvent } from 'react-native'
import type { AppBarProps, ScaffoldProps } from './types'

type SlotProps = {
  slotName: string
  children: ReactNode
}

const SlotNativeView: React.ComponentType<SlotProps> = requireNativeView('ExpoUI', 'SlotView')

function Slot(props: SlotProps) {
  return <SlotNativeView {...props} />
}

type Padding = { start?: number; top?: number; end?: number; bottom?: number }

const NativeScaffoldView: React.ComponentType<
  Omit<
    ScaffoldProps,
    'topBar' | 'bottomBar' | 'floatingActionButton' | 'onSnackbarDismiss' | 'onSnackbarAction'
  > & {
    onSnackbarDismiss?: (event: NativeSyntheticEvent<Record<string, never>>) => void
    onSnackbarAction?: (event: NativeSyntheticEvent<Record<string, never>>) => void
  }
> = requireNativeView('TodaViews', 'ScaffoldView')

export function Scaffold(props: ScaffoldProps) {
  const {
    topBar,
    bottomBar,
    floatingActionButton,
    children,
    onSnackbarDismiss,
    onSnackbarAction,
    ...restProps
  } = props

  return (
    <NativeScaffoldView
      {...restProps}
      onSnackbarDismiss={onSnackbarDismiss ? () => onSnackbarDismiss() : undefined}
      onSnackbarAction={onSnackbarAction ? () => onSnackbarAction() : undefined}
    >
      {/* The native Scaffold resolves slots once, so every slot stays mounted. */}
      <Slot slotName='topBar'>{topBar}</Slot>
      <Slot slotName='bottomBar'>{bottomBar}</Slot>
      <Slot slotName='floatingActionButton'>{floatingActionButton}</Slot>
      {children}
    </NativeScaffoldView>
  )
}

type NativeAppBarProps = Omit<AppBarProps, 'navigationIcon' | 'actions' | 'titleContent'> & {
  children?: ReactNode
}

const NativeTopAppBarView: React.ComponentType<NativeAppBarProps> = requireNativeView(
  'TodaViews',
  'TopAppBarView',
)

const NativeLargeTopAppBarView: React.ComponentType<NativeAppBarProps> = requireNativeView(
  'TodaViews',
  'LargeTopAppBarView',
)

function appBarSlots({ navigationIcon, actions, titleContent }: AppBarProps) {
  return (
    <>
      {titleContent ? <Slot slotName='title'>{titleContent}</Slot> : null}
      {navigationIcon ? <Slot slotName='navigationIcon'>{navigationIcon}</Slot> : null}
      {/* Native app bars resolve slots once; actions that appear after loading need it mounted. */}
      <Slot slotName='actions'>{actions}</Slot>
    </>
  )
}

export function TopAppBar(props: AppBarProps) {
  const {
    navigationIcon: _navigationIcon,
    actions: _actions,
    titleContent: _title,
    ...rest
  } = props

  return <NativeTopAppBarView {...rest}>{appBarSlots(props)}</NativeTopAppBarView>
}

export function LargeTopAppBar(props: AppBarProps) {
  const {
    navigationIcon: _navigationIcon,
    actions: _actions,
    titleContent: _title,
    ...rest
  } = props

  return <NativeLargeTopAppBarView {...rest}>{appBarSlots(props)}</NativeLargeTopAppBarView>
}

type HeaderAppBarProps = {
  children: ReactNode
  /** One colour throughout, rather than the scrolled colour once content passes under it. */
  containerColor?: ColorValue
}

const NativeHeaderAppBarView: React.ComponentType<HeaderAppBarProps> = requireNativeView(
  'TodaViews',
  'HeaderAppBarView',
)

/**
 * A top bar made of its children, such as a search field, that slides away as the screen's list
 * scrolls down and returns on any scroll up, taking the scrolled colour once content passes under
 * it. Goes in a Scaffold's top bar with the enter-always behaviour.
 */
export function HeaderAppBar(props: HeaderAppBarProps) {
  return <NativeHeaderAppBarView {...props} />
}

type HeaderFieldProps = {
  children: ReactNode
  /** One colour throughout, a level above a header backdrop that never takes the scrolled colour. */
  containerColor?: ColorValue
}

const NativeHeaderFieldView: React.ComponentType<HeaderFieldProps> = requireNativeView(
  'TodaViews',
  'HeaderFieldView',
)

/** The pill a search field sits in, brightening as the header it is in takes its scrolled colour. */
export function HeaderField(props: HeaderFieldProps) {
  return <NativeHeaderFieldView {...props} />
}

const NativeAnimatedRotationView: React.ComponentType<{ children: ReactNode; turned: boolean }> =
  requireNativeView('TodaViews', 'AnimatedRotationView')

/** Turns its content, such as a chevron, half a circle when `turned`, easing there and back. */
export function AnimatedRotation(props: { children: ReactNode; turned: boolean }) {
  return <NativeAnimatedRotationView {...props} />
}

const NativeBodyCentreView: React.ComponentType<{ children: ReactNode }> = requireNativeView(
  'TodaViews',
  'BodyCentreView',
)

/** Fills the body and centres its content in what the keyboard leaves in view. */
export function BodyCentre({ children }: { children: ReactNode }) {
  return <NativeBodyCentreView>{children}</NativeBodyCentreView>
}

type GatedListProps = {
  contentPadding?: Padding
  /** Space between items, in dp. */
  spacing?: number
  children: ReactNode
}

const NativeGatedListView: React.ComponentType<GatedListProps> = requireNativeView(
  'TodaViews',
  'GatedListView',
)

/**
 * A lazy list, one item per child, under a `HeaderAppBar`: the bar slides away only when the
 * content overflows.
 */
export function GatedList(props: GatedListProps) {
  return <NativeGatedListView {...props} />
}

export type ReorderListProps = {
  /** One stable key per child, in the children's order. */
  keys: string[]
  /** Which children can be held and dragged; headers and the like stay put. */
  draggable: boolean[]
  contentPadding?: Padding
  spacing?: number
  /**
   * The shape items draw themselves in, in dp from the list's sides, for items without a
   * background of their own: a held item is tinted in it, with no shadow. Without it, a held
   * item is lifted on a shadowed surface as wide as the list.
   */
  heldTint?: { inset: number; corner: number }
  /** The order after a drop, with the key of the item that moved. */
  onReorder: (key: string, order: string[]) => void
  children: ReactNode
}

const NativeReorderListView: React.ComponentType<
  Omit<ReorderListProps, 'onReorder'> & {
    onReorder: (event: NativeSyntheticEvent<{ key: string; order: string[] }>) => void
  }
> = requireNativeView('TodaViews', 'ReorderListView')

/**
 * A lazy list, one item per child, whose draggable items are held to pick up and dropped in a new
 * place; the new order is reported once, on the drop.
 */
export function ReorderList({ onReorder, ...props }: ReorderListProps) {
  return (
    <NativeReorderListView
      {...props}
      onReorder={(event) => onReorder(event.nativeEvent.key, event.nativeEvent.order)}
    />
  )
}

export type ModalSheetRef = {
  /** Animates the sheet away; `onDismissRequest` follows once it is hidden. */
  hide: () => Promise<void>
}

export type ModalSheetProps = {
  children: ReactNode
  ref?: Ref<ModalSheetRef>
  onDismissRequest: () => void
  /** The opening stop as a share of the screen, for content taller than it. Defaults to half. */
  initialHeightFraction?: number
  /** Shorter content opens at its own height. Defaults to true. */
  wrapContent?: boolean
  /**
   * Rises above the keyboard, for a sheet with a text field of its own. Defaults to false, so the
   * sheet stays put while a dialog over it takes text.
   */
  avoidKeyboard?: boolean
}

const NativeModalSheetView: React.ComponentType<
  Omit<ModalSheetProps, 'onDismissRequest' | 'initialHeightFraction' | 'wrapContent'> & {
    initialHeightFraction: number
    wrapContent: boolean
    onDismissRequest: () => void
  }
> = requireNativeView('TodaViews', 'ModalSheetView')

/**
 * The app's one bottom sheet: content height up to its opening stop, full-height expansion as
 * its content scrolls, and one native dismissal path for Back, the scrim and `hide`.
 */
export function ModalSheet({
  initialHeightFraction = 0.5,
  wrapContent = true,
  onDismissRequest,
  ...props
}: ModalSheetProps) {
  return (
    <NativeModalSheetView
      {...props}
      initialHeightFraction={initialHeightFraction}
      wrapContent={wrapContent}
      onDismissRequest={() => onDismissRequest()}
    />
  )
}

const NativeSheetListView: React.ComponentType<{
  children: ReactNode
  initialIndex: number
  minHeight: number
}> = requireNativeView('TodaViews', 'SheetListView')

/** A sheet's lazy list of connected cards that opens with `initialIndex` in view. */
export function SheetCardList({
  children,
  initialIndex = 0,
  minHeight = 0,
}: {
  children: ReactNode
  initialIndex?: number
  /** The list is at least this tall in dp, so a short list still opens the sheet this far. */
  minHeight?: number
}) {
  return (
    <NativeSheetListView initialIndex={initialIndex} minHeight={minHeight}>
      {children}
    </NativeSheetListView>
  )
}

export type ConnectedButtonGroupItem = {
  key: string
  label: string
  /** Spoken instead of the label where the label alone says too little. */
  description?: string
  icon: ReactNode
  /** Shows a choice that is on. */
  checked?: boolean
  onPress: () => void
  onLongPress?: () => void
}

const NativeConnectedButtonGroupView: React.ComponentType<{
  children: ReactNode
  labels: string[]
  descriptions: string[]
  checked: boolean[]
  longPressable: boolean[]
  onItemPress: (event: NativeSyntheticEvent<{ index: number }>) => void
  onItemLongPress: (event: NativeSyntheticEvent<{ index: number }>) => void
}> = requireNativeView('TodaViews', 'ConnectedButtonGroupView')

/** A Material 3 Expressive connected button group of icon-and-label toggle buttons. */
export function ConnectedButtonGroup({ items }: { items: ConnectedButtonGroupItem[] }) {
  return (
    <NativeConnectedButtonGroupView
      labels={items.map((item) => item.label)}
      descriptions={items.map((item) => item.description ?? '')}
      checked={items.map((item) => item.checked ?? false)}
      longPressable={items.map((item) => item.onLongPress !== undefined)}
      onItemPress={(event) => items[event.nativeEvent.index]?.onPress()}
      onItemLongPress={(event) => items[event.nativeEvent.index]?.onLongPress?.()}
    >
      {items.map((item, index) => (
        <Slot key={item.key} slotName={`icon${index}`}>
          {item.icon}
        </Slot>
      ))}
    </NativeConnectedButtonGroupView>
  )
}
