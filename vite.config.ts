import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'

const generatedFiles = [
  'apps/mobile/android/**',
  'apps/mobile/ios/**',
  'apps/mobile/.expo/**',
  'apps/mobile/src/locales/**/messages.ts',
  'apps/mobile/expo-env.d.ts',
  '**/convex/_generated/**',
  '**/routeTree.gen.ts',
  '**/worker-configuration.d.ts',
  'coverage/**',
  'patches/**',
]

const toolingFiles = [
  '.agent/**',
  '.agents/**',
  '.claude/**',
  '.codex/**',
  '.continue/**',
  '.cursor/**',
  '.gemini/**',
  '.opencode/**',
  '.pi/**',
  '.roo/**',
  '.windsurf/**',
  'tools/oxlint/anti-slop/**',
]

export default defineConfig({
  // The mobile app's `@/` imports, for its tests.
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/mobile/src', import.meta.url)) } },
  staged: { '*': 'vp check --fix' },
  fmt: {
    ignorePatterns: [...generatedFiles, ...toolingFiles],
    semi: false,
    singleQuote: true,
    jsxSingleQuote: true,
    sortImports: { newlinesBetween: false },
    sortPackageJson: { sortScripts: true },
  },
  lint: {
    ignorePatterns: [...generatedFiles, ...toolingFiles],
    jsPlugins: [{ name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' }],
    options: { typeAware: true },
    rules: {
      'oxc/no-accumulating-spread': 'error',
      'anti-slop/no-array-filter-map': 'error',
      'anti-slop/no-reduce-accumulator-copy': 'error',
      'anti-slop/no-chained-type-assertions': 'error',
      'anti-slop/no-conditional-empty-object-spread': 'error',
      'anti-slop/no-known-value-widening': 'error',
      'anti-slop/no-module-mocking': 'error',
      'anti-slop/no-object-parameters': 'error',
      'anti-slop/no-reflect-apply': 'error',
      'anti-slop/no-reflect-get': 'error',
      'anti-slop/no-runtime-typeof': 'error',
      'anti-slop/no-shape-in-symbol-names': 'error',
      'anti-slop/no-unknown-parameters': 'error',
      'anti-slop/no-unknown-returns': 'error',
      'anti-slop/no-unknown-type-aliases': 'error',
      'anti-slop/no-unsafe-dictionary-type': 'error',
      'anti-slop/no-widen-then-assert': 'error',
      'anti-slop/require-readable-spacing': 'error',
      'anti-slop/require-safety-comment-for-type-assertion': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          fix: { imports: 'safe-fix', variables: 'off' },
        },
      ],
      'typescript/no-floating-promises': 'error',
      'typescript/no-misused-promises': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'convex/values',
              importNames: ['v'],
              message: 'Import the schema-derived v from the Convex schema instead.',
            },
          ],
        },
      ],
    },
  },
  test: {
    exclude: ['**/*.live.test.ts', '**/node_modules/**', '**/dist/**'],
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
  },
})
