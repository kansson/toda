import { useLocalSearchParams } from 'expo-router'
import { useLinkStandIn } from '@/components/link-stand-in'

/**
 * `toda://add`, from the widgets, the launcher shortcut and text another app shared: a stand-in
 * that becomes the new task's page, on the list named (`useLinkStandIn`).
 */
export default function AddRoute() {
  useLinkStandIn('/new', useLocalSearchParams<Record<string, string>>())

  return null
}
