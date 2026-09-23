export const isSettled = game => ['finished', 'bye', 'skipped'].includes(game.status)
export function currentStage(tournament) {
  if (tournament.challengerId || tournament.winnerId) return 'championship'
  if (tournament.type === 'B' && tournament.stageOneFinished) return 'challenger'
  return 'groups'
}
export function matchLabel(game) {
  if (!game) return 'earlier match'
  const bracket = game.bracket || ''
  const match = bracket.match(/^([WL]\d+)-(\d+)$/)
  if (match) return `${match[1]}-${Number(match[2]) + 1}`
  return ({ GF: 'Grand final', RESET: 'Reset final', 'CHALLENGER-FINAL': 'Challenger final' })[bracket] || bracket || `Game ${game.round}`
}

export function sourceSlot(source, games) {
  if (typeof source === 'number') return { countryId: source }
  if (source === null) return { label: 'Bye', bye: true }
  const parent = games.find(game => game.id === source?.match)
  if (parent && isSettled(parent)) {
    const countryId = source.outcome === 'winner' ? parent.winnerId : parent.loserId
    return countryId ? { countryId } : { label: 'Bye', bye: true }
  }
  return { label: `${source?.outcome === 'loser' ? 'Loser' : 'Winner'} of ${matchLabel(parent)}` }
}

export function roundsFor(games, kind) {
  const columns = new Map()
  const stageRounds = { R32: [0, 'Opening round'], R16: [1, 'Round of 32'], R8: [2, 'Round of 16'], R4: [3, 'Quarterfinals'], R2: [4, 'Semifinals'], CHALLENGER: [5, 'Challenger final'] }
  for (const game of games) {
    let order, title
    if (kind === 'challenger') [order, title] = stageRounds[game.bracket.split('-')[0]]
    else if (kind === 'finals') { order = game.bracket === 'GF' ? 0 : 1; title = order ? 'Reset (if needed)' : 'Grand final' }
    else { order = Number(game.bracket.match(/^[WL](\d+)/)[1]); title = `${kind === 'winners' ? 'Winners' : 'Losers'} round ${order}` }
    if (!columns.has(order)) columns.set(order, { order, title, games: [] })
    columns.get(order).games.push(game)
  }
  return [...columns.values()].sort((a, b) => a.order - b.order)
}

// Positions derive from the stored graph, not from a balanced-tree assumption:
// late entrants and losers-bracket injection rounds remain connected correctly.
export function bracketLayout(rounds) {
  const positions = new Map()
  const width = 252, gap = 44, height = 190, spacing = 24
  let bottom = height
  rounds.forEach((round, column) => {
    let nextTop = 0
    round.games.forEach(game => {
      const parents = (game.sources || []).map(source => positions.get(source?.match)).filter(Boolean)
      const desired = parents.length ? parents.reduce((sum, p) => sum + p.y, 0) / parents.length : nextTop
      const y = Math.max(nextTop, desired)
      positions.set(game.id, { x: column * (width + gap), y })
      nextTop = y + height + spacing
      bottom = Math.max(bottom, y + height)
    })
  })
  return { positions, width, gap, height, totalWidth: Math.max(1, rounds.length) * (width + gap) - gap, totalHeight: bottom }
}

export function aBoundaries(group, size) {
  const promotion = { B: 2, C: 3, D: 4, E: 5, F: 6 }[group]
  const relegation = { A: 2, B: 3, C: 4, D: 5, E: 6 }[group]
  return [
    ...(group === 'A' ? [{ after: 1, kind: 'qualify', label: 'Championship qualification above' }] : []),
    ...(promotion ? [{ after: promotion, kind: 'promote', label: `Top ${promotion} promoted` }] : []),
    ...(relegation ? [{ after: size - relegation, kind: 'relegate', label: `Bottom ${relegation} relegated` }] : []),
  ]
}
