export function shuffle(items, random = Math.random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Do not use Date.UTC(year, ...): JavaScript treats years 0–99 as 1900–1999.
export function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export function dateString(date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function addDays(value, days) {
  const date = parseDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return dateString(date)
}

export function day(year, monthDay) { return `${String(year).padStart(4, '0')}-${monthDay}` }

export function spreadDates(start, end, count, occupied = new Set()) {
  const span = Math.round((parseDate(end) - parseDate(start)) / 86400000)
  const selected = new Set()
  return Array.from({ length: count }, (_, index) => {
    const ideal = Math.round(index * span / Math.max(1, count - 1))
    let chosen
    for (let distance = 0; distance <= span && chosen === undefined; distance++) {
      for (const offset of distance ? [ideal - distance, ideal + distance] : [ideal]) {
        if (offset < 0 || offset > span) continue
        const candidate = addDays(start, offset)
        if (!occupied.has(candidate) && !selected.has(candidate)) { chosen = candidate; break }
      }
    }
    chosen ??= addDays(start, ideal)
    selected.add(chosen)
    return chosen
  }).sort()
}

export function roundRobin(players) {
  const ring = [...players]
  if (ring.length % 2) ring.push(null)
  return Array.from({ length: ring.length - 1 }, () => {
    const pairs = Array.from({ length: ring.length / 2 }, (_, i) => [ring[i], ring[ring.length - 1 - i]]).filter(pair => !pair.includes(null))
    ring.splice(1, 0, ring.pop())
    return pairs
  })
}

export function swissPairs(entries, random = Math.random) {
  const pools = new Map()
  for (const entry of entries) {
    const pool = pools.get(entry.history) || []
    pool.push(entry.countryId)
    pools.set(entry.history, pool)
  }
  return [...pools.values()].flatMap(pool => {
    if (pool.length % 2) throw new Error('An exact-history Swiss pool must have an even number of players.')
    const players = shuffle(pool, random)
    return Array.from({ length: players.length / 2 }, (_, i) => players.slice(2 * i, 2 * i + 2))
  })
}

export function seededPositions(size) {
  let seeds = [1, 2]
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1
    seeds = seeds.flatMap(seed => [seed, sum - seed])
  }
  return seeds
}

// Graph nodes reference a participant, or the winner/loser of an earlier node.
export function doubleElimination(players) {
  const size = 2 ** Math.ceil(Math.log2(players.length))
  const nodes = []
  const winner = id => ({ match: id, outcome: 'winner' })
  const loser = id => ({ match: id, outcome: 'loser' })
  function node(id, sources) {
    const depth = 1 + Math.max(-1, ...sources.map(source => source?.match ? nodes.find(n => n.id === source.match).depth : -1))
    nodes.push({ id, sources, depth })
    return id
  }
  let winners = []
  const positions = seededPositions(size).map(seed => players[seed - 1] ?? null)
  for (let i = 0; i < size / 2; i++) winners.push(node(`W1-${i}`, positions.slice(2 * i, 2 * i + 2)))
  let losers = []
  for (let i = 0; i < winners.length / 2; i++) losers.push(node(`L1-${i}`, winners.slice(i * 2, i * 2 + 2).map(loser)))
  let round = 2
  while (winners.length > 1) {
    const previous = winners
    winners = []
    for (let i = 0; i < previous.length / 2; i++) winners.push(node(`W${round}-${i}`, previous.slice(i * 2, i * 2 + 2).map(winner)))
    losers = losers.map((id, i) => node(`L${round * 2 - 2}-${i}`, [winner(id), loser(winners[winners.length - 1 - i])]))
    if (winners.length > 1) {
      const previousLosers = losers
      losers = []
      for (let i = 0; i < previousLosers.length / 2; i++) losers.push(node(`L${round * 2 - 1}-${i}`, previousLosers.slice(i * 2, i * 2 + 2).map(winner)))
    }
    round++
  }
  const final = node('GF', [winner(winners[0]), winner(losers[0])])
  node('RESET', [winner(final), loser(final)])
  return nodes
}
