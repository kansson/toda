/**
 * The Convex deployment a development build starts on, so a developer never types it:
 * `EXPO_PUBLIC_CONVEX_URL`, or else the one `convex dev` wrote to `apps/backend/.env.local`.
 * Preview and production builds carry none; the phone asks for its server on first launch, so no
 * deployment is ever built into a published app.
 */
export function developmentServer(override: string | undefined, backendEnv: string | null) {
  const written = backendEnv?.match(/^CONVEX_URL=(.*)$/mu)?.[1]
  const url = override?.trim() || written?.trim().replace(/^(["'])(.*)\1$/u, '$2') || null

  if (url !== null && !/^https?:\/\/[^\s/]+/u.test(url)) throw new Error(`Not a Convex URL: ${url}`)

  return url
}
