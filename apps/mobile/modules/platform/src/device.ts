import { type NativeModule, requireOptionalNativeModule } from 'expo'

declare class DeviceNativeModule extends NativeModule {
  canScheduleExactAlarms(): boolean
  openExactAlarmSettings(): void
  openNotificationSettings(): void
}

/** Null where the native module is not linked, such as in tests; callers then do without. */
export const Device = requireOptionalNativeModule<DeviceNativeModule>('TodaDevice')
