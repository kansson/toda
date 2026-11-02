import { describe, expect, it } from 'vitest'
import { developmentServer } from './backend'

describe('developmentServer', () => {
  const backendEnv = [
    '# Deployment used by `npx convex dev`',
    'CONVEX_DEPLOYMENT=dev:example-123',
    '',
    'CONVEX_URL=https://example-123.convex.cloud',
  ].join('\n')

  it('takes the deployment convex dev wrote, unless overridden', () => {
    expect(developmentServer(undefined, backendEnv)).toBe('https://example-123.convex.cloud')
    expect(developmentServer(' http://127.0.0.1:3210 ', backendEnv)).toBe('http://127.0.0.1:3210')
    expect(developmentServer(undefined, 'CONVEX_URL="https://quoted.convex.cloud"')).toBe(
      'https://quoted.convex.cloud',
    )
  })

  it('has none without either, and refuses anything that is not a URL', () => {
    expect(developmentServer(undefined, null)).toBeNull()
    expect(developmentServer('', 'CONVEX_DEPLOYMENT=dev:example-123')).toBeNull()
    expect(() => developmentServer('not a url', null)).toThrow()
  })
})
