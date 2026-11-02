import { NativeModule, requireNativeModule } from 'expo'

declare class TodaUINativeModule extends NativeModule<{ onNativeDismissal: () => void }> {
  setReactNativeBack(enabled: boolean): boolean
  setBackPreviewBlocked(blocked: boolean): boolean
  freezeScreen(tag: number): Promise<boolean>
  thawScreen(tag: number): Promise<void>
  takeNativeDismissal(): boolean
}

const TodaUIModule = requireNativeModule<TodaUINativeModule>('TodaUI')

/**
 * Calls `listener` when a committed back swipe is about to dismiss the top stack screen natively,
 * a few hundred milliseconds before it does; returns how to stop listening.
 */
export function onNativeDismissal(listener: () => void) {
  const subscription = TodaUIModule.addListener('onNativeDismissal', listener)

  return () => subscription.remove()
}

/**
 * Whether React Native handles Back. Off at the root screen, so Android owns Back there and can
 * animate back to the home screen; false while no activity is attached yet. Wherever it is on, a
 * back swipe previews the stack screen below (`StackBack.kt`).
 */
export function setReactNativeBack(enabled: boolean) {
  return TodaUIModule.setReactNativeBack(enabled)
}

/**
 * While true, a back swipe shows no preview of the stack screen below, for while a JavaScript
 * back handler takes Back for itself; false while no activity is attached yet.
 */
export function setBackPreviewBlocked(blocked: boolean) {
  return TodaUIModule.setBackPreviewBlocked(blocked)
}

/** How long a closing screen may wait for its frame before it leaves without one. */
const freezeLimitMs = 120

/**
 * Keeps the last frame of the screen holding the view with `tag` over it while the stack moves it
 * away; true once it is in place, false when it could not be kept in time.
 */
export function freezeScreen(tag: number): Promise<boolean> {
  return Promise.race([
    TodaUIModule.freezeScreen(tag).catch(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), freezeLimitMs)),
  ])
}

/** Removes the kept frame from a screen that stayed. */
export function thawScreen(tag: number) {
  void TodaUIModule.thawScreen(tag).catch(() => undefined)
}

/**
 * Whether a committed predictive back has just dismissed a screen natively, once. React then
 * removes the screen only to follow, with nothing left on screen to keep a frame of.
 */
export function takeNativeDismissal() {
  return TodaUIModule.takeNativeDismissal()
}
