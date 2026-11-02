import { spawnSync } from 'node:child_process'
import { randomUUID, webcrypto } from 'node:crypto'

/**
 * Gives a Convex deployment the RS256 key its sessions are signed with: `AUTH_PRIVATE_KEY`, a
 * base64 PKCS#8 PEM, and `AUTH_JWKS`, its public half. Arguments go on to `convex env set`, such
 * as `--prod`. The private key goes straight to Convex and is never printed. Running it again
 * replaces the key: every phone's session ends, and each signs in again with its credential.
 */
const flags = process.argv.slice(2)

const pair = await webcrypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
)

const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', pair.privateKey))

const lines = pkcs8.toString('base64').match(/.{1,64}/gu) ?? []

const pem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`

const { kty, n, e } = await webcrypto.subtle.exportKey('jwk', pair.publicKey)

const values = {
  AUTH_PRIVATE_KEY: Buffer.from(pem).toString('base64'),
  AUTH_JWKS: JSON.stringify({ keys: [{ kty, n, e, kid: randomUUID(), alg: 'RS256', use: 'sig' }] }),
}

for (const [name, value] of Object.entries(values)) {
  const result = spawnSync('pnpm', ['exec', 'convex', 'env', 'set', ...flags, name, value], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })

  if (result.status !== 0) {
    console.error(`Couldn’t set ${name}.`)
    process.exit(1)
  }

  console.log(`${name} set`)
}
