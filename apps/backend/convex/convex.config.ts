import auth from '@convex-dev/auth/convex.config.js'
import { defineApp } from 'convex/server'
// Component environment validators must not depend on the app schema.
// oxlint-disable-next-line no-restricted-imports
import { v } from 'convex/values'

const app = defineApp({
  env: { AUTH_PRIVATE_KEY: v.string(), AUTH_JWKS: v.string() },
})

// Sessions and their signing key; the JWKS is served under /auth for `auth.config.ts`.
app.use(auth, {
  httpPrefix: '/auth',
  env: { AUTH_PRIVATE_KEY: app.env.AUTH_PRIVATE_KEY, AUTH_JWKS: app.env.AUTH_JWKS },
})

export default app
