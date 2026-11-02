import { describe, expect, it } from 'vitest'
import { isDeviceSecret, randomDeviceSecret } from './device-secret'

describe('device secrets', () => {
  it('are 64 lowercase hex digits drawn from the random digits of UUIDs', () => {
    let calls = 0

    const secret = randomDeviceSecret(() => {
      calls += 1

      return `${String(calls).repeat(8)}-aaaa-4bbb-8ccc-dddddddddddd`
    })

    expect(isDeviceSecret(secret)).toBe(true)
    expect(secret).not.toContain('4bbb')
  })

  it('rejects anything else', () => {
    expect(isDeviceSecret('A'.repeat(64))).toBe(false)
    expect(isDeviceSecret('a'.repeat(63))).toBe(false)
  })
})
