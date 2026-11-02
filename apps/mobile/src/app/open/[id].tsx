import { useLocalSearchParams } from 'expo-router'
import { useLinkStandIn } from '@/components/link-stand-in'

/** `toda://open/<id>`, from a task tapped in a widget: a stand-in that becomes its page. */
export default function OpenTaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()

  useLinkStandIn('/task/[id]', { id })

  return null
}
