import { useLingui } from '@lingui/react/macro'
import { useFocusEffect } from 'expo-router'
import { useCallback, useRef } from 'react'
import { fillMaxWidth, size } from '@/lib/compose-modifiers'
import {
  AnimatedVisibility,
  Box,
  EnterTransition,
  ExitTransition,
  Icon,
  IconButton,
  Text,
  TextField,
  type TextFieldRef,
  useMaterialColors,
  useNativeState,
} from '@/lib/compose-ui'
import { glyphs } from '@/ui/glyphs'
import { HeaderField } from '../../modules/ui'

/**
 * The main screen's search field, in the pill a header holds: a search glyph, the query, and a
 * clear button that fades and scales in while there is one. The keyboard's search key and a tap
 * outside put the keyboard away; clearing empties the field and focuses it again; leaving the
 * screen lets go of it, so the keyboard never moves with the page.
 */
export function SearchField({
  query,
  onQueryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
}) {
  const { t } = useLingui()
  const colors = useMaterialColors()
  const text = useNativeState('')
  const field = useRef<TextFieldRef>(null)
  const focused = useRef(false)

  useFocusEffect(
    useCallback(
      () => () => {
        void field.current?.blur()
      },
      [],
    ),
  )

  // Empties the field and puts the cursor back in it, so the next search can start at once.
  const clear = () => {
    text.value = ''
    onQueryChange('')

    if (!focused.current) void field.current?.focus()
  }

  return (
    // A level above the screen's surfaceContainer backdrop, so the pill stands apart from it.
    <HeaderField containerColor={colors.surfaceContainerHighest}>
      <TextField
        ref={field}
        value={text}
        singleLine
        keyboardOptions={{ imeAction: 'search', autoCorrectEnabled: false }}
        keyboardActions={{ onSearch: () => void field.current?.blur() }}
        onValueChange={onQueryChange}
        onFocusChanged={(next) => {
          focused.current = next
        }}
        colors={{
          focusedContainerColor: 'transparent',
          unfocusedContainerColor: 'transparent',
          focusedIndicatorColor: 'transparent',
          unfocusedIndicatorColor: 'transparent',
        }}
        modifiers={[fillMaxWidth()]}
      >
        <TextField.LeadingIcon>
          <Box modifiers={[size(48, 48)]} contentAlignment='center'>
            <Icon source={glyphs.search} size={24} tint={colors.onSurfaceVariant} />
          </Box>
        </TextField.LeadingIcon>
        {/*
          The slot is always mounted and holds a button-sized box, as vaka's search does; only the
          button inside fades and scales in and out. The field resolves its slots once, so a slot
          added later never shows, and an empty one never makes room.
        */}
        <TextField.TrailingIcon>
          <Box modifiers={[size(48, 48)]} contentAlignment='center'>
            <AnimatedVisibility
              visible={query !== ''}
              enterTransition={EnterTransition.fadeIn().plus(
                EnterTransition.scaleIn({ initialScale: 0.6 }),
              )}
              exitTransition={ExitTransition.fadeOut().plus(
                ExitTransition.scaleOut({ targetScale: 0.6 }),
              )}
            >
              <IconButton onClick={clear}>
                <Icon
                  source={glyphs.clear}
                  size={24}
                  contentDescription={t({
                    message: 'Clear search',
                    comment: 'Search field button emptying it',
                  })}
                />
              </IconButton>
            </AnimatedVisibility>
          </Box>
        </TextField.TrailingIcon>
        <TextField.Placeholder>
          <Text color={colors.onSurfaceVariant}>
            {t({ message: 'Search tasks', comment: 'Search field placeholder' })}
          </Text>
        </TextField.Placeholder>
      </TextField>
    </HeaderField>
  )
}
