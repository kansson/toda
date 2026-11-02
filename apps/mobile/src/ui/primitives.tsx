import type { ReactNode } from 'react'
import {
  animateContentSize,
  background,
  clickable,
  clip,
  composeGeometry,
  fillMaxSize,
  fillMaxWidth,
  height,
  horizontalScroll,
  padding,
  paddingAll,
  size,
  verticalScroll,
  weight,
} from '@/lib/compose-modifiers'
import {
  Box,
  Button,
  Column,
  ExtendedFloatingActionButton,
  FilterChip,
  Icon,
  IconButton,
  LazyColumn,
  ListItem,
  LoadingIndicator,
  Row,
  Text,
  TextButton,
  useMaterialColors,
  VerticalDivider,
} from '@/lib/compose-ui'
import { AnimatedRotation } from '../../modules/ui'
import { type Glyph, glyphs } from './glyphs'

export type ListProps = {
  children: ReactNode
  bottomPadding?: number
  /** Card groups inset from the screen edges, as in settings. */
  grouped?: boolean
  /** The first load: a loader centred in the whole body instead of the list. */
  loading?: boolean
}

/** A vertically scrolling list owning the screen body; every child is one lazy item. */
export function List({
  children,
  bottomPadding = 16,
  grouped = false,
  loading = false,
}: ListProps) {
  if (loading) {
    return <LoadingPage />
  }

  return (
    <LazyColumn
      modifiers={[fillMaxSize()]}
      contentPadding={
        grouped
          ? { start: 16, end: 16, top: 8, bottom: Math.max(bottomPadding, 32) }
          : { top: 4, bottom: bottomPadding }
      }
      verticalArrangement={grouped ? { spacedBy: 20 } : undefined}
    >
      {children}
    </LazyColumn>
  )
}

export type GroupRow = {
  key: string
  label: string
  /** One short line; rows without it stay single-line with the glyph centred. */
  value?: string
  glyph?: Glyph
  /** The chosen row of a single-choice group, drawn in the secondary container colour. */
  selected?: boolean
  /** A trailing chevron: the row opens a screen where its value can be changed. */
  drillIn?: boolean
  /** A short figure at the row's end, such as a count. */
  trailing?: string
  onPress?: () => void
}

/** Where a row sits in a run of card rows: the run's outer corners are round, its joins tight. */
/** Where a card sits in a run of cards: the run's outer corners are round, its joins tight. */
export function cardCorners(index: number, count: number) {
  const top = index === 0 ? 20 : 4
  const bottom = index === count - 1 ? 20 : 4

  return composeGeometry.RoundedCorner({
    topStart: top,
    topEnd: top,
    bottomStart: bottom,
    bottomEnd: bottom,
  })
}

function GroupTitle({ title }: { title: string }) {
  const colors = useMaterialColors()

  return (
    <Text
      color={colors.primary}
      modifiers={[padding(4, 0, 4, 0)]}
      style={{ typography: 'titleSmall' }}
    >
      {title}
    </Text>
  )
}

/** A titled card for free-form content, matching the card groups around it. */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const colors = useMaterialColors()

  return (
    <Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 8 }}>
      {title ? <GroupTitle title={title} /> : null}
      <Column
        modifiers={[
          fillMaxWidth(),
          clip(composeGeometry.RoundedCorner(20)),
          background(colors.surfaceContainerHigh),
          padding(16, 16, 16, 16),
          animateContentSize(),
        ]}
        verticalArrangement={{ spacedBy: 12 }}
      >
        {children}
      </Column>
    </Column>
  )
}

/**
 * A titled group of connected card rows: the group's outer corners are round, the joins between
 * rows are tight, like Material settings lists.
 */
export function Group({ title, rows }: { title?: string; rows: GroupRow[] }) {
  const colors = useMaterialColors()

  return (
    <Column modifiers={[fillMaxWidth()]} verticalArrangement={{ spacedBy: 8 }}>
      {title ? <GroupTitle title={title} /> : null}
      <Column
        modifiers={[fillMaxWidth(), animateContentSize()]}
        verticalArrangement={{ spacedBy: 2 }}
      >
        {rows.map((row, index) => (
          <ListItem
            // Compose reads a ListItem's slots once, so a row that gains a line is drawn afresh.
            key={`${row.key}:${row.value ? 'v' : ''}${row.drillIn ? 'd' : ''}${row.trailing === undefined ? '' : 't'}`}
            colors={{
              containerColor: row.selected
                ? colors.secondaryContainer
                : colors.surfaceContainerHigh,
            }}
            modifiers={[
              fillMaxWidth(),
              clip(cardCorners(index, rows.length)),
              ...(row.onPress ? [clickable(row.onPress)] : []),
            ]}
          >
            {row.glyph ? (
              <ListItem.LeadingContent>
                <Icon source={glyphs[row.glyph]} size={24} tint={colors.onSurfaceVariant} />
              </ListItem.LeadingContent>
            ) : null}
            <ListItem.HeadlineContent>
              <Text>{row.label}</Text>
            </ListItem.HeadlineContent>
            {row.value ? (
              <ListItem.SupportingContent>
                <Text color={colors.onSurfaceVariant} maxLines={1} overflow='ellipsis'>
                  {row.value}
                </Text>
              </ListItem.SupportingContent>
            ) : null}
            {row.drillIn ? (
              <ListItem.TrailingContent>
                <Icon source={glyphs.drillIn} size={24} tint={colors.onSurfaceVariant} />
              </ListItem.TrailingContent>
            ) : row.trailing === undefined ? null : (
              <ListItem.TrailingContent>
                <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }}>
                  {row.trailing}
                </Text>
              </ListItem.TrailingContent>
            )}
          </ListItem>
        ))}
      </Column>
    </Column>
  )
}

/**
 * The loader for a body that has nothing to show yet, centred in all the space left to it. Use in
 * place of a list: items inside a lazy list cannot fill its height.
 */
export function LoadingPage() {
  return (
    <Box contentAlignment='center' modifiers={[fillMaxSize()]}>
      <LoadingIndicator modifiers={[size(48, 48)]} />
    </Box>
  )
}

/** An inline loader inside a list that already shows something, such as more results. */
export function Loading() {
  return (
    <Box contentAlignment='center' modifiers={[fillMaxWidth(), paddingAll(32)]}>
      <LoadingIndicator modifiers={[size(48, 48)]} />
    </Box>
  )
}

export type EmptyProps = {
  glyph: Glyph
  title: string
  message?: string
  /**
   * Centred in this height in dp, or in the whole screen body with `fill`, instead of the top;
   * `content` is only as tall as itself, for a parent that centres it.
   */
  height?: number | 'fill' | 'content'
  actionLabel?: string
  onAction?: () => void
}

export function Empty({ glyph, title, message, height: fixed, actionLabel, onAction }: EmptyProps) {
  const colors = useMaterialColors()

  const content = (
    <Column
      horizontalAlignment='center'
      verticalArrangement={{ spacedBy: 12 }}
      modifiers={[
        fillMaxWidth(),
        fixed === undefined ? padding(32, 48, 32, 32) : padding(32, 0, 32, 0),
      ]}
    >
      {/* The glyph's room is kept before Expo's vector loader has drawn it, so the title never
          jumps down a frame later. */}
      <Box modifiers={[size(48, 48)]} contentAlignment='center'>
        <Icon source={glyphs[glyph]} size={48} tint={colors.onSurfaceVariant} />
      </Box>
      <Text style={{ typography: 'titleLarge', textAlign: 'center' }}>{title}</Text>
      {message ? (
        <Text
          color={colors.onSurfaceVariant}
          style={{ typography: 'bodyMedium', textAlign: 'center' }}
        >
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button onClick={onAction} modifiers={[padding(0, 8, 0, 0)]}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </Column>
  )

  return fixed === undefined || fixed === 'content' ? (
    content
  ) : (
    <Box
      contentAlignment='center'
      modifiers={fixed === 'fill' ? [fillMaxSize()] : [fillMaxWidth(), height(fixed)]}
    >
      {content}
    </Box>
  )
}

export type NoticeProps = {
  glyph: Glyph
  message: string
  actionLabel?: string
  onAction?: () => void
  tone?: 'neutral' | 'error'
}

/** An inline message inside a screen, such as a failed request with its retry. */
export function Notice({ glyph, message, actionLabel, onAction, tone = 'neutral' }: NoticeProps) {
  const colors = useMaterialColors()
  const container = tone === 'error' ? colors.errorContainer : colors.surfaceContainerHigh
  const content = tone === 'error' ? colors.onErrorContainer : colors.onSurfaceVariant

  return (
    <Box modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
      <ListItem
        colors={{ containerColor: container, contentColor: content }}
        modifiers={[fillMaxWidth(), clip(composeGeometry.RoundedCorner(16))]}
      >
        <ListItem.LeadingContent>
          <Icon source={glyphs[glyph]} size={24} tint={content} />
        </ListItem.LeadingContent>
        <ListItem.HeadlineContent>
          <Text color={content} style={{ typography: 'bodyMedium' }}>
            {message}
          </Text>
        </ListItem.HeadlineContent>
        {actionLabel && onAction ? (
          <ListItem.TrailingContent>
            <TextButton onClick={onAction}>
              <Text>{actionLabel}</Text>
            </TextButton>
          </ListItem.TrailingContent>
        ) : null}
      </ListItem>
    </Box>
  )
}

/**
 * A compact heading over a group of rows, such as Today or a list's name, with how many rows it
 * holds. With `onToggle` the whole heading folds its group away and back, its chevron turning.
 */
export function SectionHeader({
  title,
  count,
  collapsed = false,
  onToggle,
}: {
  title: string
  count?: number
  collapsed?: boolean
  onToggle?: () => void
}) {
  const colors = useMaterialColors()

  return (
    <Row
      verticalAlignment='center'
      horizontalArrangement={{ spacedBy: 8 }}
      modifiers={[
        fillMaxWidth(),
        padding(8, 8, 8, 0),
        clip(composeGeometry.RoundedCorner(12)),
        ...(onToggle ? [clickable(onToggle)] : []),
        padding(12, 6, 8, 6),
      ]}
    >
      <Text color={colors.primary} maxLines={1} style={{ typography: 'titleSmall' }}>
        {title}
      </Text>
      {count === undefined ? null : (
        <Box
          modifiers={[
            clip(composeGeometry.RoundedCorner(8)),
            background(colors.secondaryContainer),
            padding(6, 1, 6, 1),
          ]}
        >
          <Text color={colors.onSecondaryContainer} style={{ typography: 'labelSmall' }}>
            {String(count)}
          </Text>
        </Box>
      )}
      <Box modifiers={[weight(1)]} />
      {onToggle ? (
        <AnimatedRotation turned={!collapsed}>
          <Icon source={glyphs.expand} size={20} tint={colors.onSurfaceVariant} />
        </AnimatedRotation>
      ) : null}
    </Row>
  )
}

/** The screen's main action as a Material extended floating button, labelled. */
export function Fab({
  glyph,
  label,
  onPress,
  expanded = true,
}: {
  glyph: Glyph
  label: string
  onPress: () => void
  /** Shrinks to the icon alone, as while a list scrolls. */
  expanded?: boolean
}) {
  return (
    <ExtendedFloatingActionButton onClick={onPress} expanded={expanded}>
      <ExtendedFloatingActionButton.Icon>
        <Icon source={glyphs[glyph]} size={24} contentDescription={label} />
      </ExtendedFloatingActionButton.Icon>
      <ExtendedFloatingActionButton.Text>
        <Text>{label}</Text>
      </ExtendedFloatingActionButton.Text>
    </ExtendedFloatingActionButton>
  )
}

export type FieldRowProps = {
  glyph: Glyph
  /** What the row sets, shown when it has no value. */
  label: string
  value?: string | null
  /** The value stands out in the error colour, such as a date that has passed. */
  urgent?: boolean
  onPress: () => void
  /** A trailing clear button for a set value. */
  clearLabel?: string
  onClear?: () => void
}

/**
 * One of a task's settings, such as its date or repeat: its glyph and value, or the setting's name
 * dimmed while unset, opening its picker when tapped.
 */
export function FieldRow({
  glyph,
  label,
  value,
  urgent = false,
  onPress,
  clearLabel,
  onClear,
}: FieldRowProps) {
  const colors = useMaterialColors()
  const hasValue = Boolean(value)
  const content = urgent ? colors.error : hasValue ? colors.onSurface : colors.onSurfaceVariant

  return (
    <ListItem
      key={`${glyph}:${hasValue ? 'v' : ''}`}
      colors={{ containerColor: colors.surface }}
      modifiers={[fillMaxWidth(), clickable(onPress)]}
    >
      <ListItem.LeadingContent>
        <Icon
          source={glyphs[glyph]}
          size={24}
          tint={hasValue ? content : colors.onSurfaceVariant}
        />
      </ListItem.LeadingContent>
      <ListItem.HeadlineContent>
        <Text color={content} style={{ typography: 'bodyLarge' }}>
          {value || label}
        </Text>
      </ListItem.HeadlineContent>
      <ListItem.TrailingContent>
        {hasValue && onClear ? (
          <IconButton onClick={onClear}>
            <Icon
              source={glyphs.clear}
              size={20}
              tint={colors.onSurfaceVariant}
              contentDescription={clearLabel ?? ''}
            />
          </IconButton>
        ) : (
          <Box />
        )}
      </ListItem.TrailingContent>
    </ListItem>
  )
}

export type FilterChoice = { key: string; label: string; glyph?: Glyph }

/** A chip that opens a sheet of choices, such as the sort or the list, with its arrow. */
function DropdownChip({
  label,
  glyph,
  selected,
  onPress,
}: {
  label: string
  /** Shown in place of the label, which is still spoken. */
  glyph?: Glyph
  selected: boolean
  onPress: () => void
}) {
  return (
    <FilterChip selected={selected} onClick={onPress} modifiers={[animateContentSize()]}>
      <FilterChip.Label>
        {glyph ? (
          <Icon source={glyphs[glyph]} size={20} contentDescription={label} />
        ) : (
          <Text maxLines={1}>{label}</Text>
        )}
      </FilterChip.Label>
      <FilterChip.TrailingIcon>
        <Icon source={glyphs.expand} size={18} />
      </FilterChip.TrailingIcon>
    </FilterChip>
  )
}

/**
 * The main screen's chips, as vaka's library has them: the sort chip as an icon, the scope chip
 * (every list, or the one chosen) showing as chosen only when it narrows what is shown, a
 * divider, then the views, each tapped on and off again. Chips ease to the width of their labels.
 */
export function ChipRow({
  sort,
  scope,
  views,
  view,
  onView,
}: {
  sort: { label: string; onPress: () => void }
  scope: { label: string; narrowed: boolean; onPress: () => void }
  views: FilterChoice[]
  /** The view tapped on, or none. */
  view: string | null
  onView: (key: string | null) => void
}) {
  return (
    // A plain scrolling row rather than a lazy one: a lazy row drops the chips scrolled out of view
    // and draws them afresh on the way back, each icon loading a frame after its chip, which then
    // widens and shoves the row along. The few chips stay drawn here.
    <Row
      horizontalArrangement={{ spacedBy: 8 }}
      verticalAlignment='center'
      modifiers={[fillMaxWidth(), horizontalScroll(), padding(16, 0, 16, 8)]}
    >
      <DropdownChip
        key='sort'
        label={sort.label}
        glyph='sort'
        selected={false}
        onPress={sort.onPress}
      />
      <DropdownChip
        key='scope'
        label={scope.label}
        selected={scope.narrowed}
        onPress={scope.onPress}
      />
      <VerticalDivider key='divider' modifiers={[size(1, 20)]} />
      {views.map((chip) => {
        const on = chip.key === view

        return (
          <FilterChip key={chip.key} selected={on} onClick={() => onView(on ? null : chip.key)}>
            {chip.glyph ? (
              <FilterChip.LeadingIcon>
                <Icon source={glyphs[chip.glyph]} size={18} />
              </FilterChip.LeadingIcon>
            ) : null}
            <FilterChip.Label>
              <Text>{chip.label}</Text>
            </FilterChip.Label>
          </FilterChip>
        )
      })}
    </Row>
  )
}

/**
 * The answer a sheet builds up, such as a repeat rule in words, in the secondary container
 * colour at its top: the anchor the options below change.
 */
export function SummaryCard({
  glyph,
  title,
  message,
}: {
  glyph: Glyph
  title: string
  message?: string
}) {
  const colors = useMaterialColors()

  return (
    <Row
      verticalAlignment='center'
      horizontalArrangement={{ spacedBy: 16 }}
      modifiers={[
        fillMaxWidth(),
        clip(composeGeometry.RoundedCorner(24)),
        background(colors.secondaryContainer),
        padding(20, 18, 20, 18),
        animateContentSize(),
      ]}
    >
      <Box
        contentAlignment='center'
        modifiers={[
          size(48, 48),
          clip(composeGeometry.Material.Cookie9Sided),
          background(colors.secondary),
        ]}
      >
        <Icon source={glyphs[glyph]} size={24} tint={colors.onSecondary} />
      </Box>
      <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 2 }}>
        <Text color={colors.onSecondaryContainer} style={{ typography: 'titleMedium' }}>
          {title}
        </Text>
        {message ? (
          <Text color={colors.onSecondaryContainer} style={{ typography: 'bodyMedium' }}>
            {message}
          </Text>
        ) : null}
      </Column>
    </Row>
  )
}

/** A licence's text in a sheet, scrolling, in small type that wraps to the phone's width. */
export function LicenseText({ text }: { text: string }) {
  const colors = useMaterialColors()

  return (
    <Column modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 0, 24, 32)]}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
        {text}
      </Text>
    </Column>
  )
}
