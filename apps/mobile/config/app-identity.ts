const variants = ['development', 'preview', 'production'] as const

export type AppVariant = (typeof variants)[number]

function isVariant(value: string): value is AppVariant {
  return variants.some((variant) => variant === value)
}

export function appIdentity(value: string | undefined) {
  const variant = value ?? 'development'

  if (!isVariant(variant)) {
    throw new Error(`Unknown APP_VARIANT: ${variant}`)
  }

  const suffix = variant === 'production' ? '' : variant === 'development' ? '.dev' : '.preview'

  return {
    variant,
    name:
      variant === 'production' ? 'Toda' : variant === 'development' ? 'Toda Dev' : 'Toda Preview',
    androidPackage: `app.toda.android${suffix}`,
    scheme:
      variant === 'production' ? 'toda' : variant === 'development' ? 'toda-dev' : 'toda-preview',
  }
}
