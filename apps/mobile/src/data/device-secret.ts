const SECRET = /^[0-9a-f]{64}$/

export function isDeviceSecret(value: string) {
  return SECRET.test(value)
}

/**
 * 32 random bytes as lowercase hex. Hermes has no Web Crypto, but the Expo core module's v4
 * UUIDs come from the platform CSPRNG (arc4random on iOS, SecureRandom on Android), so no new
 * native module is needed and the change ships over the air.
 */
export function randomDeviceSecret(uuid: () => string = () => globalThis.expo.uuidv4()) {
  let hex = ''

  while (hex.length < 64) {
    // Skip the fixed version digit and the variant digit; the other 30 digits are random.
    const digits = uuid().replaceAll('-', '').toLowerCase()
    hex += digits.slice(0, 12) + digits.slice(13, 16) + digits.slice(17)
  }

  return hex.slice(0, 64)
}
