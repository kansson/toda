import { randomUUID } from 'expo-crypto'

/** A new row's identity on every device, made before the row reaches the server. */
export function newId() {
  return randomUUID()
}
