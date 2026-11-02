/// <reference types="node" />
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  type AndroidConfig,
  type ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} from 'expo/config-plugins'

/** An activity as the manifest holds it, with the meta-data entries Expo's type leaves out. */
type Activity = AndroidConfig.Manifest.ManifestActivity & {
  'meta-data'?: AndroidConfig.Manifest.ManifestMetaData[]
}

/**
 * The launcher's long-press shortcut to a new task, opening `<scheme>://add` like the widget's
 * button, with its label translated through Android's string resources.
 */
export const withNewTaskShortcut =
  (scheme: string, labels: { en: string; sv: string }): ConfigPlugin =>
  (config) => {
    config = withStringsXml(config, (stringsConfig) => {
      const strings = stringsConfig.modResults.resources.string ?? []

      stringsConfig.modResults.resources.string = [
        ...strings.filter((entry) => entry.$.name !== 'shortcut_new_task'),
        { $: { name: 'shortcut_new_task' }, _: labels.en },
      ]

      return stringsConfig
    })

    config = withDangerousMod(config, [
      'android',
      async (modConfig) => {
        const res = join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res')
        const packageName = modConfig.android?.package ?? ''

        await mkdir(join(res, 'xml'), { recursive: true })
        await mkdir(join(res, 'values-sv'), { recursive: true })

        await writeFile(
          join(res, 'xml/shortcuts.xml'),
          `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="new_task"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/shortcut_new_task">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:data="${scheme}://add" />
  </shortcut>
</shortcuts>
`,
        )

        await writeFile(
          join(res, 'values-sv/shortcuts.xml'),
          `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="shortcut_new_task">${labels.sv}</string>
</resources>
`,
        )

        return modConfig
      },
    ])

    return withAndroidManifest(config, (manifestConfig) => {
      const activity: Activity | undefined =
        manifestConfig.modResults.manifest.application?.[0]?.activity?.find(
          (candidate) => candidate.$['android:name'] === '.MainActivity',
        )

      if (!activity) throw new Error('Unable to add the launcher shortcut: no MainActivity')

      activity['meta-data'] = [
        ...(activity['meta-data'] ?? []).filter(
          (entry) => entry.$['android:name'] !== 'android.app.shortcuts',
        ),
        { $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } },
      ]

      return manifestConfig
    })
  }
