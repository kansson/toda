/**
 * Orders are fractional positions: a moved or new item takes a number between its neighbours, so
 * one write moves it. Once neighbours get too close to tell apart, the whole run is renumbered.
 */
export type Positioned = { id: string; position: number }

const MIN_GAP = 1e-6

/** A position between two neighbours; either may be missing at the ends. */
export function between(before: number | undefined, after: number | undefined) {
  if (before === undefined && after === undefined) return 0

  if (before === undefined) return after! - 1

  if (after === undefined) return before + 1

  return (before + after) / 2
}

/** A position above every sibling, for a new item at the top. */
export function topPosition(siblings: readonly Positioned[]) {
  return siblings.length === 0 ? 0 : Math.min(...siblings.map((item) => item.position)) - 1
}

/** A position below every sibling. */
export function bottomPosition(siblings: readonly Positioned[]) {
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((item) => item.position)) + 1
}

/**
 * The position changes that put `id` where it is in `order`, the siblings' ids in their new
 * order: usually one, or every sibling renumbered when the gap has worn too thin.
 */
export function placeInOrder(
  siblings: readonly Positioned[],
  order: readonly string[],
  id: string,
) {
  const byId = new Map(siblings.map((item) => [item.id, item]))
  const others = order.filter((key) => key !== id && byId.has(key))
  const index = order.filter((key) => byId.has(key)).indexOf(id)

  if (index < 0) return []
  const before = index > 0 ? byId.get(others[index - 1]!)?.position : undefined
  const after = index < others.length ? byId.get(others[index]!)?.position : undefined

  if (before !== undefined && after !== undefined && after - before < MIN_GAP) {
    const renumbered: Positioned[] = []
    let rank = 0

    for (const key of order) {
      if (!byId.has(key)) continue

      if (byId.get(key)?.position !== rank) renumbered.push({ id: key, position: rank })
      rank += 1
    }

    return renumbered
  }

  const position = between(before, after)

  return byId.get(id)?.position === position ? [] : [{ id, position }]
}
