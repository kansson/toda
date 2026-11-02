import { z } from 'zod'

const secureUrl = z.url({ protocol: /^https$/u })

const anyUrl = z.url({ protocol: /^https?$/u })

/**
 * A server's address as typed or pasted, reduced to its origin, or null when it is not one.
 * `https://` is assumed when left out; plain `http` is for development only, as for a backend on
 * the computer.
 */
export function parseServer(input: string, allowHttp = false) {
  const text = input.trim()
  const withScheme = /^[a-z][\d+.a-z-]*:\/\//iu.test(text) ? text : `https://${text}`
  const result = (allowHttp ? anyUrl : secureUrl).safeParse(withScheme)

  if (!result.success) return null

  const origin = /^(https?:\/\/[^/?#]+)/iu.exec(result.data)?.[1]

  return origin?.toLowerCase() ?? null
}

/** The address without its scheme, as Settings shows it. */
export function serverHost(server: string) {
  return server.replace(/^https?:\/\//iu, '')
}
