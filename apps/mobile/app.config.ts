import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ConfigContext, ExpoConfig } from 'expo/config'
import {
  type ConfigPlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withProjectBuildGradle,
} from 'expo/config-plugins'
import { appIdentity } from './config/app-identity.ts'
import { developmentServer } from './config/backend.ts'
import { withNewTaskShortcut } from './config/plugins/with-shortcuts.ts'

/**
 * Gives Gradle twice the template's memory, for R8 to minify release builds in. Android
 * Gradle Plugin 9 already shrinks resources the optimised way, and release builds keep the
 * template's optimised R8 rules, since it refuses the unoptimised ones.
 */
const withGradleMemory: ConfigPlugin = (config) =>
  withGradleProperties(config, (gradleConfig) => {
    const key = 'org.gradle.jvmargs'
    const value = '-Xmx4096m -XX:MaxMetaspaceSize=1024m'

    const existing = gradleConfig.modResults.find(
      (item) => item.type === 'property' && item.key === key,
    )

    if (existing?.type === 'property') {
      existing.value = value
    } else {
      gradleConfig.modResults.push({ key, type: 'property', value })
    }

    return gradleConfig
  })

const releaseSigningMarker = '// Toda: release signing'

/**
 * Signs release builds with the owner's upload key when `~/.gradle/gradle.properties` names it
 * (`TODA_UPLOAD_STORE_FILE`, `TODA_UPLOAD_STORE_PASSWORD`, `TODA_UPLOAD_KEY_ALIAS`,
 * `TODA_UPLOAD_KEY_PASSWORD`). Without it, a release of the production app is refused rather
 * than signed with the debug key, which no properly signed update could replace; development
 * and preview releases fall back to the debug key.
 */
const withReleaseSigning =
  (production: boolean): ConfigPlugin =>
  (config) =>
    withAppBuildGradle(config, (gradleConfig) => {
      let contents = gradleConfig.modResults.contents

      if (contents.includes(releaseSigningMarker)) {
        return gradleConfig
      }

      const signingConfigs = '    signingConfigs {\n'

      const releaseSigning =
        '            signingConfig signingConfigs.debug\n            def enableShrinkResources'

      if (!contents.includes(signingConfigs) || !contents.includes(releaseSigning)) {
        throw new Error('Unable to configure release signing')
      }

      contents = contents.replace(
        signingConfigs,
        `${signingConfigs}        ${releaseSigningMarker}: the upload key named in gradle.properties.
        release {
            if (findProperty('TODA_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('TODA_UPLOAD_STORE_FILE'))
                storePassword findProperty('TODA_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('TODA_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('TODA_UPLOAD_KEY_PASSWORD')
            }
        }
`,
      )

      contents = contents.replace(
        releaseSigning,
        `            signingConfig findProperty('TODA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug
            def enableShrinkResources`,
      )

      if (production) {
        contents += `
${releaseSigningMarker}: a production release is never signed with the debug key.
gradle.taskGraph.whenReady { graph ->
  def releasing = graph.allTasks.any { it.name ==~ /(assemble|bundle|package)Release/ }

  if (releasing && !findProperty('TODA_UPLOAD_STORE_FILE')) {
    throw new GradleException('Set TODA_UPLOAD_STORE_FILE and its passwords in ~/.gradle/gradle.properties to sign a production release.')
  }
}
`
      }

      gradleConfig.modResults.contents = contents

      return gradleConfig
    })

/**
 * The release's name, such as `1.1.0` or a nightly's `1.1.0-nightly.20261001.42+c2fa9fc`, set by
 * the release workflow; local builds are 0.0.1.
 */
const versionName = process.env.TODA_VERSION_NAME ?? '0.0.1'

/**
 * Writes the release's whole name into `build.gradle`, where Android, and the app through
 * expo-application, read it. The config's `version` keeps only its leading numbers, since
 * expo-localization finds where its settings go by a `versionName` of numbers alone; this runs
 * after it, as plugins wrapping the config run after those it lists.
 */
const withVersionName: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    const versionLine = /versionName "[^"]*"/u

    if (!versionLine.test(gradleConfig.modResults.contents)) {
      throw new Error('Unable to set the version name')
    }

    gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
      versionLine,
      `versionName "${versionName}"`,
    )

    return gradleConfig
  })

const abiSplitsMarker = '// Toda: one release APK per CPU architecture'

/**
 * Splits a release build into one APK per CPU architecture, such as
 * `app-arm64-v8a-release.apk`, each with only that architecture's native libraries, so a phone
 * installs a third of the size of one holding them all. Debug builds stay whole, and
 * `-PreactNativeArchitectures` narrows the split as it narrows what is compiled. Every split
 * keeps the same version code: they are installed by hand, not offered side by side in a store.
 */
const withAbiSplits: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents

    if (contents.includes(abiSplitsMarker)) {
      return gradleConfig
    }

    const android = '\nandroid {\n'

    if (!contents.includes(android)) {
      throw new Error('Unable to configure ABI splits')
    }

    gradleConfig.modResults.contents = contents.replace(
      android,
      `${android}    ${abiSplitsMarker}, in release builds only.
    splits {
        abi {
            enable gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') }
            reset()
            include(*((findProperty('reactNativeArchitectures') ?: 'armeabi-v7a,arm64-v8a,x86,x86_64').split(',')))
            universalApk false
        }
    }

`,
    )

    return gradleConfig
  })

const expoModuleCacheMarker = '// Toda: the expo module compiles this app’s module list'

/**
 * Keeps the `expo` module out of Gradle's build cache. It compiles the list of this app's native
 * modules, generated at build time, and Expo CLI builds with `--build-cache`: a cached compile
 * came back without that list, so the app crashed at start with `ExpoModulesPackageList` missing.
 */
const withFreshExpoModuleList: ConfigPlugin = (config) =>
  withProjectBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.contents.includes(expoModuleCacheMarker)) {
      return gradleConfig
    }

    gradleConfig.modResults.contents += `
${expoModuleCacheMarker}, which a cached compile has restored without; it
// always compiles afresh so the app never starts without its modules.
subprojects { subproject ->
  if (subproject.name == 'expo') {
    subproject.tasks.configureEach { task ->
      task.outputs.doNotCacheIf('It compiles the generated list of this app’s modules') { true }
    }
  }
}
`

    return gradleConfig
  })

/**
 * Stack screens open and close with Android 17's activity transitions, the ones the system
 * Settings app uses between its pages: the app's resources replace the react-native-screens
 * `default` animation (its Android 13 values) by name. `extend` needs Android 13, so older
 * versions keep the library's own.
 */
const withAndroidStackTransitions: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const source = join(modConfig.modRequest.projectRoot, 'config', 'android-transitions')
      const folder = join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/anim-v33')
      await mkdir(folder, { recursive: true })

      for (const name of [
        'rns_default_enter_in.xml',
        'rns_default_enter_out.xml',
        'rns_default_exit_in.xml',
        'rns_default_exit_out.xml',
      ]) {
        await copyFile(join(source, name), join(folder, name))
      }

      return modConfig
    },
  ])

/** Neutral Material 3 surfaces, for the splash screen where Android has no dynamic one. */
const splashBackground = { light: '#F9F9FC', dark: '#131316' }

/**
 * The splash screen sits on the app's own background, so opening the app shows no field of colour
 * before its first screen. From Android 14 that is the system's dynamic surface colour, the one the
 * app's screens take from the wallpaper; before it, the neutral surfaces above.
 */
const withSurfaceSplash: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const resources = join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res')

      for (const [folder, color] of [
        ['values-v34', 'system_surface_light'],
        ['values-night-v34', 'system_surface_dark'],
      ] as const) {
        await mkdir(join(resources, folder), { recursive: true })
        await writeFile(
          join(resources, folder, 'splash_colors.xml'),
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="splashscreen_background">@android:color/${color}</color>\n</resources>\n`,
        )
      }

      return modConfig
    },
  ])

/**
 * Leaves out the settings Expo's prebuild writes for over-the-air updates, which this app does not
 * use: without `expo-updates` nothing reads them.
 */
const withoutUpdatesSettings: ConfigPlugin = (config) =>
  withAndroidManifest(config, (manifestConfig) => {
    for (const application of manifestConfig.modResults.manifest.application ?? []) {
      application['meta-data'] = application['meta-data']?.filter(
        (item) => !item.$['android:name'].startsWith('expo.modules.updates.'),
      )
    }

    return manifestConfig
  })

/** What the app reads from `Constants.expoConfig.extra` (`src/lib/config.ts`). */
type AppExtra = { appVariant: string; defaultServer?: string }

/** What `convex dev` wrote for this checkout's own deployment, if it has run. */
function backendEnv(projectRoot: string) {
  const path = join(projectRoot, '..', 'backend', '.env.local')

  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const variant = appIdentity(process.env.APP_VARIANT)

  const server =
    variant.variant === 'development'
      ? developmentServer(process.env.EXPO_PUBLIC_CONVEX_URL, backendEnv(projectRoot))
      : null

  const extra: AppExtra = { appVariant: variant.variant }

  // Left out when absent: Expo's config turns a null in `extra` into `{}`.
  if (server) extra.defaultServer = server

  return withVersionName(
    withAbiSplits(
      withReleaseSigning(variant.variant === 'production')(
        withoutUpdatesSettings(
          withAndroidStackTransitions(
            withSurfaceSplash(
              withFreshExpoModuleList(
                withNewTaskShortcut(variant.scheme, { en: 'New task', sv: 'Ny uppgift' })(
                  withGradleMemory({
                    ...config,
                    name: variant.name,
                    slug: 'toda',
                    // Release builds are named and numbered by the release workflow (withVersionName).
                    version: /^\d+(?:\.\d+)*/u.exec(versionName)?.[0] ?? '0.0.1',
                    platforms: ['android'],
                    orientation: 'portrait',
                    icon: './assets/images/icon.png',
                    scheme: variant.scheme,
                    userInterfaceStyle: 'automatic',
                    android: {
                      package: variant.androidPackage,
                      // The build time in minutes, from the release workflow, so every release, stable or
                      // nightly, installs over the builds before it.
                      versionCode: Number(process.env.TODA_VERSION_CODE ?? 1),
                      allowBackup: false,
                      // Reminders at their minute; Android asks the user, and Settings explains it.
                      permissions: ['android.permission.SCHEDULE_EXACT_ALARM'],
                      // Pulled in by libraries for things the app does not use.
                      blockedPermissions: [
                        'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE',
                        'com.google.android.gms.permission.AD_ID',
                        'android.permission.USE_BIOMETRIC',
                        'android.permission.USE_FINGERPRINT',
                        'android.permission.READ_EXTERNAL_STORAGE',
                        'android.permission.WRITE_EXTERNAL_STORAGE',
                        'android.permission.RECORD_AUDIO',
                        'android.permission.SYSTEM_ALERT_WINDOW',
                      ],
                      predictiveBackGestureEnabled: true,
                      // Text shared from another app becomes a new task.
                      intentFilters: [
                        {
                          action: 'android.intent.action.SEND',
                          category: ['android.intent.category.DEFAULT'],
                          data: [{ mimeType: 'text/plain' }],
                        },
                      ],
                      // Built by `pnpm run mobile:icons` (scripts/generate-icons.ts).
                      adaptiveIcon: {
                        backgroundColor: '#202124',
                        backgroundImage: './assets/images/android-icon-background.png',
                        foregroundImage: './assets/images/android-icon-foreground.png',
                        monochromeImage: './assets/images/android-icon-monochrome.png',
                      },
                    },
                    plugins: [
                      [
                        'expo-build-properties',
                        {
                          android: {
                            enableMinifyInReleaseBuilds: true,
                            enableShrinkResourcesInReleaseBuilds: true,
                            usePrecompiledHeaders: true,
                          },
                        },
                      ],
                      ['expo-localization', { supportedLocales: ['en', 'sv'] }],
                      ['expo-secure-store', { faceIDPermission: false }],
                      [
                        'expo-splash-screen',
                        {
                          // The icon on the app's own background (withSurfaceSplash), not a colour.
                          image: './assets/images/splash-icon.png',
                          imageWidth: 160,
                          backgroundColor: splashBackground.light,
                          dark: {
                            image: './assets/images/splash-icon.png',
                            backgroundColor: splashBackground.dark,
                          },
                        },
                      ],
                      [
                        'expo-notifications',
                        { icon: './assets/images/notification-icon.png', color: '#5F6368' },
                      ],
                      'expo-router',
                      'expo-sqlite',
                      'expo-status-bar',
                    ],
                    extra,
                    experiments: { typedRoutes: true, reactCompiler: true },
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  )
}
