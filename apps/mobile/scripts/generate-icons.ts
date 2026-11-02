// Draws the Toda app icon, Material Symbols' `task_alt` in white on a flat neutral field, and
// writes every image made from it. Run with `pnpm run mobile:icons`.
//
// Android only: the adaptive icon's field and symbol as separate layers, a themed (monochrome)
// layer, the flattened icon for older launchers, the whole icon as a disc for the splash screen,
// and the symbol alone for notifications. Keep `android.adaptiveIcon`'s `backgroundColor` in
// `app.config.ts` at `field`.
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const field = '#202124'

/** The symbol's size on the 1024 canvas of an adaptive icon layer, as Material's product icons. */
const glyphSize = 384

const vector = await readFile(
  createRequire(import.meta.url).resolve('@expo/material-symbols/task_alt.xml'),
  'utf8',
)

const pathData = /android:pathData="([^"]+)"/u.exec(vector)?.[1]

if (!pathData) throw new Error('task_alt has no path')

// Material Symbols draw in a 960 viewport, their shapes within 80 to 880.
const scale = glyphSize / 800

const glyph = `<path transform="translate(512 512) scale(${scale}) translate(-480 -480)" d="${pathData}" fill="#FFFFFF"/>`

const svg = (inner: string) =>
  `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`

const background = `<rect width="1024" height="1024" fill="${field}"/>`

/**
 * The splash screen's icon: the icon as a launcher shows it, a disc of the middle two thirds, which
 * is what Android 12's splash screen shows of its canvas, on the app's own background.
 */
const splash = svg(`<circle cx="512" cy="512" r="340" fill="${field}"/>${glyph}`)

const images = fileURLToPath(new URL('../assets/images/', import.meta.url))

await mkdir(images, { recursive: true })

for (const [file, markup, size] of [
  // The flattened icon, for launchers older than adaptive icons.
  ['icon.png', svg(`${background}${glyph}`), 1024],
  ['splash-icon.png', splash, 1024],
  ['android-icon-background.png', svg(background), 1024],
  ['android-icon-foreground.png', svg(glyph), 1024],
  // Android 13+ themed icon and the notification's small icon: the symbol in white.
  ['android-icon-monochrome.png', svg(glyph), 1024],
  ['notification-icon.png', svg(glyph), 96],
] as const) {
  await sharp(Buffer.from(markup)).resize(size, size).png().toFile(`${images}${file}`)
  console.log('wrote', `assets/images/${file}`, `${size}x${size}`)
}
