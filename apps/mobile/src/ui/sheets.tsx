import { useLingui } from '@lingui/react/macro'
import { type ReactNode, useRef } from 'react'
import { clickable, clip, fillMaxWidth, padding } from '@/lib/compose-modifiers'
import { Column, Icon, ListItem, Row, Text, useMaterialColors } from '@/lib/compose-ui'
import { ModalSheet, type ModalSheetRef, TopAppBar } from '../../modules/ui'
import { type Glyph, glyphs } from './glyphs'
import { cardCorners } from './primitives'
import { Action } from './screen'

export type SheetProps = {
  title?: string
  /** Controls at the end of the title bar; given `close`, one can put the sheet away. */
  action?: (close: () => void) => ReactNode
  onDismiss: () => void
  /** Opens tall, for content that scrolls, such as an editor. */
  tall?: boolean
  /** The content; `close` animates the sheet away, after which `onDismiss` follows. */
  children: (close: () => void) => ReactNode
}

/**
 * The app's one bottom sheet: it opens at its content's height up to half the screen, grows to
 * full height as its content scrolls, and closes the same way from Back, the scrim or a choice
 * made inside it. A titled sheet has Material's small app bar as listan's sheets do: Close
 * leading, the title, then its actions. Never use Expo UI's ModalBottomSheet.
 */
export function Sheet({ title, action, onDismiss, tall = false, children }: SheetProps) {
  const { t } = useLingui()
  const sheet = useRef<ModalSheetRef>(null)
  const close = () => void sheet.current?.hide()

  return (
    <ModalSheet ref={sheet} onDismissRequest={onDismiss} initialHeightFraction={tall ? 0.9 : 0.5}>
      <Column modifiers={[fillMaxWidth()]}>
        {title ? (
          <TopAppBar
            embedded
            title={title}
            navigationIcon={
              <Action
                glyph='clear'
                label={t({ message: 'Close', comment: 'Closes a sheet' })}
                onPress={close}
              />
            }
            actions={<Row verticalAlignment='center'>{action?.(close)}</Row>}
          />
        ) : null}
        {children(close)}
      </Column>
    </ModalSheet>
  )
}

export type MenuRow = {
  key: string
  /** A command's glyph; a choice of one kind, such as a sort, goes without. */
  glyph?: Glyph
  label: string
  /** The chosen one of a choice, drawn with a check. */
  selected?: boolean
  /** Destructive rows, such as Delete, in the error colour. */
  destructive?: boolean
  disabled?: boolean
  /** Why the row is disabled, under its label. */
  note?: string
  onPress: () => void
}

/**
 * A sheet's menu as vaka's sheets have it: one connected card per command or choice, the chosen
 * one with a check at its end, the sheet closing as one is chosen.
 */
export function MenuRows({ rows, close }: { rows: MenuRow[]; close: () => void }) {
  const colors = useMaterialColors()

  return (
    <Column
      verticalArrangement={{ spacedBy: 2 }}
      modifiers={[fillMaxWidth(), padding(16, 0, 16, 24)]}
    >
      {rows.map((row, index) => {
        const content = row.disabled
          ? colors.onSurfaceVariant
          : row.destructive
            ? colors.error
            : colors.onSurface

        return (
          <ListItem
            key={`${row.key}:${row.note ? 'n' : ''}`}
            colors={{ containerColor: colors.surfaceContainerHigh }}
            modifiers={[
              fillMaxWidth(),
              clip(cardCorners(index, rows.length)),
              ...(row.disabled
                ? []
                : [
                    clickable(() => {
                      row.onPress()
                      close()
                    }),
                  ]),
            ]}
          >
            {row.glyph ? (
              <ListItem.LeadingContent>
                <Icon source={glyphs[row.glyph]} size={24} tint={content} />
              </ListItem.LeadingContent>
            ) : null}
            <ListItem.HeadlineContent>
              <Text color={content}>{row.label}</Text>
            </ListItem.HeadlineContent>
            {row.note ? (
              <ListItem.SupportingContent>
                <Text color={colors.onSurfaceVariant}>{row.note}</Text>
              </ListItem.SupportingContent>
            ) : null}
            {row.selected ? (
              <ListItem.TrailingContent>
                <Icon source={glyphs.check} size={24} tint={colors.primary} />
              </ListItem.TrailingContent>
            ) : null}
          </ListItem>
        )
      })}
    </Column>
  )
}
