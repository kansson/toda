import { useLocalSearchParams } from 'expo-router'
import { useLinkStandIn } from '@/components/link-stand-in'

/**
 * `toda://done/<id>`, from the check box of a late repeating task in a widget: a stand-in that
 * becomes its page, asking which day it was done.
 */
export default function DoneTaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()

  useLinkStandIn('/task/[id]', { id, done: '1' })

  return null
}
