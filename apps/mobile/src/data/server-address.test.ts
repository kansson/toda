import { describe, expect, it } from 'vitest'
import { parseServer, serverHost } from './server-address'

describe('parseServer', () => {
  it('keeps the origin of an address, adding https when left out', () => {
    expect(parseServer(' https://example-123.convex.cloud/ ')).toBe(
      'https://example-123.convex.cloud',
    )
    expect(parseServer('Example-123.eu-west-1.convex.cloud')).toBe(
      'https://example-123.eu-west-1.convex.cloud',
    )
    expect(parseServer('https://convex.example.com:8443/path?query')).toBe(
      'https://convex.example.com:8443',
    )
  })

  it('refuses plain http unless allowed, and anything that is not an address', () => {
    expect(parseServer('http://10.0.2.2:3210')).toBeNull()
    expect(parseServer('http://10.0.2.2:3210', true)).toBe('http://10.0.2.2:3210')
    expect(parseServer('ftp://example.com')).toBeNull()
    expect(parseServer('')).toBeNull()
    expect(parseServer('not an address')).toBeNull()
  })
})

describe('serverHost', () => {
  it('drops the scheme', () => {
    expect(serverHost('https://example-123.convex.cloud')).toBe('example-123.convex.cloud')
  })
})
