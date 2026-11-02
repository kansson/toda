import { type NativeModule, requireOptionalNativeModule } from 'expo'

declare class ShareNativeModule extends NativeModule<{ onShare: () => void }> {
  takeShared(): { text: string | null; subject: string | null } | null
}

/** Text shared from another app; null where the native module is not linked. */
export const Share = requireOptionalNativeModule<ShareNativeModule>('TodaShare')
