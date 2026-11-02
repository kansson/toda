// The open-source licences shown under Settings → About: every package the app depends on
// directly, with its version, licence and licence text as installed, and the native Android
// libraries bundled with it, listed below. Run with `pnpm run mobile:licenses` after adding,
// removing or upgrading a dependency, and update `nativeLibraries` when the native ones change.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const root = new URL('../', import.meta.url)

const manifest = z
  .object({ dependencies: z.record(z.string(), z.string()) })
  .parse(JSON.parse(await readFile(new URL('package.json', root), 'utf8')))

/** What a dependency's manifest says about itself; licence and repository have two forms. */
const packageManifest = z.object({
  version: z.string(),
  license: z
    .union([z.string(), z.object({ type: z.string() }).transform((value) => value.type)])
    .nullish(),
  repository: z
    .union([z.string(), z.object({ url: z.string() }).transform((value) => value.url)])
    .nullish(),
})

/** A direct dependency's folder: pnpm links each one at the top of node_modules. */
function packageDirectory(name: string) {
  return path.join(fileURLToPath(root), 'node_modules', name)
}

async function licenceText(directory: string) {
  const files = await readdir(directory)
  const file = files.find((entry) => /^(?:licen[cs]e|copying)(?:\.(?:md|txt))?$/iu.test(entry))

  return file ? reflow(await readFile(path.join(directory, file), 'utf8')) : null
}

/**
 * Joins the hard-wrapped lines of each paragraph, so the text wraps to the phone's width instead
 * of breaking where an 80-column file did.
 */
function reflow(text: string) {
  return text
    .trim()
    .split(/\n\s*\n/u)
    .map((paragraph: string) => paragraph.replace(/\s*\n\s*/gu, ' ').trim())
    .join('\n\n')
}

function repositoryUrl(url: string | null | undefined) {
  return url ? url.replace(/^git\+/u, '').replace(/\.git$/u, '') : null
}

const licences = []

/**
 * Native Android libraries bundled into the app, with the versions Gradle resolves for a
 * release build (`./gradlew :app:dependencies --configuration releaseRuntimeClasspath`). All are
 * Apache 2.0.
 */
const nativeLibraries = [
  { name: 'AndroidX DynamicAnimation', version: '1.1.0' },
  { name: 'AndroidX WorkManager', version: '2.7.1' },
  { name: 'Jetpack Compose', version: '1.12.1' },
  { name: 'Jetpack Compose Material 3', version: '1.5.0-beta01' },
  { name: 'Jetpack Glance', version: '1.2.0' },
  { name: 'Kotlin coroutines', version: '1.10.2' },
  { name: 'Kotlin standard library', version: '2.2.20' },
  { name: 'Material Components for Android', version: '1.13.0' },
  { name: 'Material Symbols', version: '' },
  { name: 'OkHttp', version: '4.9.2' },
  { name: 'Reorderable', version: '3.1.0' },
]

const apache = reflow(await readFile(new URL('scripts/licenses/Apache-2.0.txt', root), 'utf8'))

// The app's own workspace packages are part of it, not open-source dependencies.
const thirdParty = Object.entries(manifest.dependencies)
  .filter(([, version]) => !version.startsWith('workspace:'))
  .map(([name]) => name)

for (const name of thirdParty.sort()) {
  const directory = packageDirectory(name)

  const installed = packageManifest.parse(
    JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')),
  )

  licences.push({
    name,
    version: installed.version,
    license: installed.license ?? null,
    repository: repositoryUrl(installed.repository),
    text: await licenceText(directory),
  })
}

for (const library of nativeLibraries) {
  licences.push({ ...library, license: 'Apache-2.0', repository: null, text: apache })
}

// Packages from one repository share its licence; some are published without their own copy. One
// that names no repository is left without, rather than given the native libraries' Apache text.
for (const entry of licences) {
  entry.text ??= entry.repository
    ? (licences.find((other) => other.text && other.repository === entry.repository)?.text ?? null)
    : null
}

await writeFile(
  new URL('src/about/licenses.json', root),
  `${JSON.stringify(
    licences.map(({ repository: _repository, ...entry }) => entry),
    null,
    2,
  )}\n`,
)

console.log(`Wrote ${licences.length} licences`)
