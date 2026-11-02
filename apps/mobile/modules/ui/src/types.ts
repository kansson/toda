import type * as React from 'react'
import type { ColorValue, StyleProp, ViewStyle } from 'react-native'

export type TopAppBarScrollBehavior = 'enterAlways' | 'exitUntilCollapsed' | 'none' | 'pinned'

export type ScaffoldProps = {
  topBar?: React.ReactNode
  bottomBar?: React.ReactNode
  floatingActionButton?: React.ReactNode
  children?: React.ReactNode
  /**
   * Material 3 top app bar scroll behavior. The Scaffold owns the behavior and shares it with
   * the app bar rendered in `topBar`. Use `exitUntilCollapsed` for large app bars and
   * `enterAlways` or `pinned` for small ones. Defaults to `none`.
   */
  scrollBehavior?: TopAppBarScrollBehavior
  /** Disable for screens that sit above the app's own navigation bar. Defaults to true. */
  bottomInset?: boolean
  snackbarId?: number
  snackbarMessage?: string
  /** A button on the snackbar, such as Undo. */
  snackbarAction?: string
  onSnackbarAction?: () => void
  /** Replaces the `surface` background, such as transparent over a surface that already paints. */
  containerColor?: ColorValue
  onSnackbarDismiss?: () => void
  style?: StyleProp<ViewStyle>
}

export type AppBarProps = {
  title: string
  titleContent?: React.ReactNode
  containerColor?: ColorValue
  /** The title centred on the bar, as Material's centre-aligned small app bar has it. */
  centered?: boolean
  /** In a sheet: no window insets, no scrolling, and the sheet's colour behind it. */
  embedded?: boolean
  navigationIcon?: React.ReactNode
  actions?: React.ReactNode
  style?: StyleProp<ViewStyle>
}
