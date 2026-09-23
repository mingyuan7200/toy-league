import { RULES, simulate } from '../../shared/blotto.js'
import { addDays, day, doubleElimination, roundRobin, shuffle, spreadDates, swissPairs } from './formats.js'

export const GROUPS = { A: ['A', 'B', 'C', 'D', 'E', 'F'], B: ['1', '2', '3', '4', '5', '6'] }
export const SIZES = { A: [10, 16, 20, 30, 48, 70], B: [16, 32, 32, 32, 32, 50] }
const PROMOTIONS = [2, 3, 4, 5, 6]
const id = () => crypto.randomUUID()
const settled = match => ['finished', 'bye', 'skipped'].includes(match.status)
const winSource = match => ({ match, outcome: 'winner' })

function newEntry(countryId, group, rank, type) {
  return { countryId, group, startingRank: type === 'A' ? rank : null, history: '', wins: 0, losses: 0, finalRank: null }
}

function match(t, { sources, date, stage, group = null, ...rest }) {
  const item = { id: id(), sources, date, stage, group, status: 'scheduled', redId: null, blueId: null, winnerId: null, loserId: null, redScore: null, blueScore: null, ...rest }
  t.matches.push(item)
  return item
}

function occupiedDates(league, type) {
  return new Set(league.tournaments.filter(t => t.type !== type).flatMap(t => t.matches.map(m => m.date)))
}

export function nextEntries(previous) {
  const type = previous.type
  const groups = GROUPS[type]
  const ranked = groups.map(group => previous.entries.filter(e => e.group === group).sort((a, b) => a.finalRank - b.finalRank))
  const moved = groups.map(() => [])
  ranked.forEach((entries, groupIndex) => {
    entries.forEach(entry => {
      const up = groupIndex > 0 ? (type === 'A' ? PROMOTIONS[groupIndex - 1] : 4) : 0
      const down = groupIndex < 5 ? (type === 'A' ? PROMOTIONS[groupIndex] : 4) : 0
      const destination = entry.finalRank <= up ? groupIndex - 1 : entry.finalRank > entries.length - down ? groupIndex + 1 : groupIndex
      moved[destination].push({ ...entry, origin: groupIndex })
    })
  })
  const oldChampion = previous.defenderId
  if (previous.winnerId !== oldChampion) {
    const vacancy = moved.findIndex(entries => entries.some(e => e.countryId === previous.winnerId))
    moved[vacancy] = moved[vacancy].filter(e => e.countryId !== previous.winnerId)
    moved[0].unshift({ countryId: oldChampion, origin: -1, finalRank: 0 })
    for (let index = 0; index < vacancy; index++) {
      const candidates = moved[index].filter(e => e.origin === index).sort((a, b) => b.finalRank - a.finalRank)
      const extra = candidates[0]
      if (!extra) throw new Error('No eligible additional relegation candidate.')
      moved[index] = moved[index].filter(e => e.countryId !== extra.countryId)
      moved[index + 1].push(extra)
    }
  }
  const entries = [newEntry(previous.winnerId, type === 'A' ? 'S' : '0', 1, type)]
  moved.forEach((players, index) => {
    if (players.length !== SIZES[type][index]) throw new Error(`Invalid next-season ${type}/${groups[index]} size: ${players.length}`)
    // A: relegated, retained, promoted. B has groups only; no seed rank.
    players.sort((a, b) => a.origin - b.origin || a.finalRank - b.finalRank)
    players.forEach((player, rank) => entries.push(newEntry(player.countryId, groups[index], rank + 1, type)))
  })
  return entries
}

function createTournament(league, type, year, random) {
  const previous = league.tournaments.find(t => t.type === type && t.year === year - 1)
  if (previous && !previous.winnerId) throw new Error('Previous season must finish before a new season starts.')
  let entries
  if (previous) entries = nextEntries(previous)
  else {
    const players = [...shuffle(league.countryIds.filter(countryId => countryId !== league.humanId), random), league.humanId]
    entries = [newEntry(players.shift(), type === 'A' ? 'S' : '0', 1, type)]
    GROUPS[type].forEach((group, index) => players.splice(0, SIZES[type][index]).forEach((countryId, rank) => entries.push(newEntry(countryId, group, rank + 1, type))))
  }
  const t = {
    id: id(), type, year, startDate: day(year, type === 'A' ? '01-01' : '07-01'),
    endDate: day(type === 'A' ? year : year + 1, type === 'A' ? '12-31' : '06-30'),
    status: 'upcoming', entries, matches: [], defenderId: entries[0].countryId,
    winnerId: null, challengerId: null, completedDate: null, stageOneFinished: false,
  }
  const occupied = occupiedDates(league, type)
  if (type === 'A') {
    GROUPS.A.forEach(group => {
      const players = entries.filter(e => e.group === group).map(e => e.countryId)
      let rounds = roundRobin(players)
      if (['D', 'E', 'F'].includes(group)) rounds = shuffle(rounds, random).slice(0, 20)
      const firstLeg = rounds.map(pairs => pairs.map(pair => random() < 0.5 ? pair : [...pair].reverse()))
      rounds = group === 'A' ? [...firstLeg, ...firstLeg.map(pairs => pairs.map(pair => [...pair].reverse()))] : firstLeg
      const dates = spreadDates(day(year, '01-01'), day(year, '10-31'), rounds.length, occupied)
      rounds.forEach((pairs, round) => pairs.forEach(sources => match(t, { sources, date: dates[round], stage: 'groups', group, fixedColors: true, round: round + 1 })))
    })
  } else {
    const start = day(year, '07-01'), end = day(year + 1, '02-28')
    t.swissDates = {}
    GROUPS.B.slice(0, 5).forEach(group => {
      t.swissDates[group] = spreadDates(start, end, group === '1' ? 4 : 5, occupied)
      addSwissRound(t, group, 1, random)
    })
    const players = shuffle(entries.filter(e => e.group === '6').map(e => e.countryId), random)
    t.eliminationOrder = players // Random tie order, not a starting rank or a pairing advantage.
    const nodes = doubleElimination(players)
    const dates = spreadDates(start, end, Math.max(...nodes.map(n => n.depth)) + 1, occupied)
    const ids = Object.fromEntries(nodes.map(node => [node.id, id()]))
    nodes.forEach(node => match(t, {
      id: ids[node.id], sources: node.sources.map(source => source?.match ? { ...source, match: ids[source.match] } : source),
      date: dates[node.depth], stage: 'groups', group: '6', bracket: node.id, depth: node.depth,
    }))
  }
  league.tournaments.push(t)
  return t
}

function addSwissRound(t, group, round, random) {
  swissPairs(t.entries.filter(e => e.group === group), random).forEach(sources => match(t, { sources, date: t.swissDates[group][round - 1], stage: 'groups', group, round }))
}

function resolveSource(t, source) {
  if (source === null || typeof source === 'number') return source
  const parent = t.matches.find(m => m.id === source.match)
  if (!parent || !settled(parent)) return undefined
  return source.outcome === 'winner' ? parent.winnerId : parent.loserId
}

function finish(t, m, redScore, blueScore) {
  m.redScore = redScore
  m.blueScore = blueScore
  m.status = 'finished'
  m.winnerId = redScore > blueScore ? m.redId : m.blueId
  m.loserId = redScore > blueScore ? m.blueId : m.redId
  if (m.stage === 'groups') {
    for (const [countryId, result] of [[m.winnerId, 'W'], [m.loserId, 'L']]) {
      const entry = t.entries.find(e => e.countryId === countryId)
      entry[result === 'W' ? 'wins' : 'losses']++
      if (t.type === 'B' && m.group !== '6') entry.history += result
    }
  }
}

export function standings(t, group) {
  return t.entries.filter(e => e.group === group).sort((a, b) => {
    if (t.type === 'A') return b.wins - a.wins || a.startingRank - b.startingRank
    if (group !== '6') return b.wins - a.wins || b.history.localeCompare(a.history) || a.countryId - b.countryId
    const elimination = entry => {
      const losses = t.matches.filter(m => m.group === '6' && m.status === 'finished' && m.loserId === entry.countryId)
      return losses.length < 2 ? Infinity : Math.max(...losses.map(m => m.depth))
    }
    const delta = elimination(b) - elimination(a)
    return (Number.isNaN(delta) ? 0 : delta) || t.eliminationOrder.indexOf(a.countryId) - t.eliminationOrder.indexOf(b.countryId)
  })
}

function addChallengerBracket(league, t) {
  const dates = spreadDates(day(t.year + 1, '03-01'), day(t.year + 1, '04-30'), 6, occupiedDates(league, 'B'))
  const entry = (group, rank) => t.entries.find(e => e.group === group && e.finalRank === rank).countryId
  const node = (key, a, b, depth) => match(t, { sources: [a, b], date: dates[depth], stage: 'challenger', bracket: key }).id
  const r32 = node('R32', entry('5', 1), entry('6', 1), 0)
  const r16 = node('R16', entry('4', 1), winSource(r32), 1)
  const r8a = node('R8-A', entry('1', 5), winSource(r16), 2)
  const r8b = node('R8-B', entry('2', 2), entry('3', 1), 2)
  const r4a = node('R4-A', entry('1', 4), winSource(r8a), 3)
  const r4b = node('R4-B', entry('1', 3), entry('2', 1), 3)
  const r4c = node('R4-C', entry('1', 2), winSource(r8b), 3)
  const r2a = node('R2-A', entry('1', 1), winSource(r4a), 4)
  const r2b = node('R2-B', winSource(r4b), winSource(r4c), 4)
  node('CHALLENGER-FINAL', winSource(r2a), winSource(r2b), 5)
}

function addChampionship(league, t, challenger, random) {
  t.challengerId = challenger
  const year = t.type === 'A' ? t.year : t.year + 1
  const dates = spreadDates(day(year, t.type === 'A' ? '11-01' : '05-01'), day(year, t.type === 'A' ? '12-01' : '06-30'), 7, occupiedDates(league, t.type))
  const players = random() < 0.5 ? [t.defenderId, challenger] : [challenger, t.defenderId]
  dates.forEach((date, index) => match(t, { sources: index % 2 ? [...players].reverse() : players, date, stage: 'championship', fixedColors: true, round: index + 1 }))
}

function advanceStages(league, t, random) {
  let changed = false
  if (t.type === 'B') {
    for (const group of GROUPS.B.slice(0, 5)) {
      const games = t.matches.filter(m => m.group === group)
      const round = Math.max(...games.map(m => m.round))
      if (round < t.swissDates[group].length && games.every(settled)) { addSwissRound(t, group, round + 1, random); changed = true }
    }
  }
  if (!t.stageOneFinished && t.matches.filter(m => m.stage === 'groups').every(settled)) {
    t.stageOneFinished = true
    for (const group of GROUPS[t.type]) standings(t, group).forEach((entry, index) => { entry.finalRank = index + 1 })
    if (t.type === 'A') addChampionship(league, t, standings(t, 'A')[0].countryId, random)
    else addChallengerBracket(league, t)
    changed = true
  }
  if (t.type === 'B' && t.stageOneFinished && !t.challengerId) {
    const final = t.matches.find(m => m.bracket === 'CHALLENGER-FINAL')
    if (final?.status === 'finished') { addChampionship(league, t, final.winnerId, random); changed = true }
  }
  if (t.challengerId && !t.winnerId) {
    const finals = t.matches.filter(m => m.stage === 'championship')
    const winner = [t.defenderId, t.challengerId].find(countryId => finals.filter(m => m.winnerId === countryId).length === 4)
    if (winner) {
      t.winnerId = winner
      t.status = 'finished'
      t.completedDate = league.date
      finals.filter(m => !settled(m)).forEach(m => { m.status = 'skipped' })
      // Store next-season group outcomes when the title is settled.
      const next = nextEntries(t)
      t.entries.forEach(entry => {
        const placement = next.find(e => e.countryId === entry.countryId)
        entry.nextGroup = placement.group
        entry.nextRank = placement.startingRank
      })
      changed = true
    }
  }
  return changed
}

export function processDay(league, random = Math.random) {
  const year = Number(league.date.slice(0, 4)), monthDay = league.date.slice(5)
  for (const [type, start] of [['A', '01-01'], ['B', '07-01']]) {
    if (monthDay === start && !league.tournaments.some(t => t.type === type && t.year === year)) createTournament(league, type, year, random)
  }
  for (const t of league.tournaments) {
    if (t.startDate > league.date || t.status === 'finished') continue
    t.status = 'active'
    let changed = true
    while (changed) {
      changed = false
      for (const m of t.matches) {
        if (settled(m)) continue
        if (m.bracket === 'RESET') {
          const final = t.matches.find(game => game.bracket === 'GF')
          if (!settled(final)) continue
          if (final.winnerId === resolveSource(t, final.sources[0])) {
            m.status = 'skipped'; m.winnerId = final.winnerId; changed = true; continue
          }
        }
        if (m.date > league.date) continue
        const players = m.sources.map(source => resolveSource(t, source))
        if (players.some(player => player === undefined)) continue
        if (players.includes(null)) {
          m.status = 'bye'; m.winnerId = players.find(player => player !== null) ?? null
          changed = true; continue
        }
        if (m.redId === null) {
          ;[m.redId, m.blueId] = m.fixedColors || random() < 0.5 ? players : [...players].reverse()
          changed = true
        }
        if (players.includes(league.humanId)) continue
        const result = simulate(random)
        finish(t, m, result.redScore, result.blueScore)
        changed = true
      }
      if (advanceStages(league, t, random)) changed = true
    }
  }
}

export function newLeague(countries, random = Math.random) {
  if (countries.length !== 195) throw new Error('A league requires all 195 countries.')
  const human = countries.find(country => /^China\b/.test(country.name))
  if (!human) throw new Error('China is missing from the country list.')
  const league = { id: id(), date: '0001-01-01', humanId: human.id, countryIds: countries.map(c => c.id), version: 0, tournaments: [] }
  createTournament(league, 'A', 1, random)
  createTournament(league, 'B', 1, random)
  processDay(league, random)
  return league
}

export function pendingGames(league) {
  return league.tournaments.flatMap(t => t.matches.filter(m => m.date <= league.date && !settled(m) && [m.redId, m.blueId].includes(league.humanId)).map(m => ({ ...m, tournamentId: t.id, tournamentType: t.type, year: t.year })))
}

export function nextDay(league, random = Math.random) {
  if (pendingGames(league).length) throw new Error('Finish all of China’s games today before advancing.')
  if (league.date >= '9998-12-31') throw new Error('The supported calendar ends in year 9998.')
  league.date = addDays(league.date, 1)
  processDay(league, random)
}

export function nextGameDay(league, random = Math.random) {
  // Always run each day's normal processing, including season creation and
  // bracket progression. Byes and cancelled games do not count as game days.
  for (let elapsed = 0; elapsed < 366; elapsed++) {
    nextDay(league, random)
    if (pendingGames(league).length || league.tournaments.some(t => t.matches.some(m => m.date === league.date && m.status === 'finished'))) return
  }
  throw new Error('No game day was found within the next year.')
}

export function submitResult(league, gameId, redScore, blueScore, random = Math.random) {
  const t = league.tournaments.find(tournament => tournament.matches.some(m => m.id === gameId))
  const m = t?.matches.find(game => game.id === gameId)
  if (!m || ![m.redId, m.blueId].includes(league.humanId)) throw new Error('This is not a playable China game.')
  if (!Number.isInteger(redScore) || !Number.isInteger(blueScore) || redScore < 0 || blueScore < 0 || redScore + blueScore !== RULES.rounds) throw new Error('Scores must be nonnegative integers adding up to 15.')
  if (m.status === 'finished') {
    if (m.redScore === redScore && m.blueScore === blueScore) return
    throw new Error('This game already has a different result.')
  }
  if (m.status !== 'scheduled' || m.date > league.date) throw new Error('This game is not due today.')
  finish(t, m, redScore, blueScore)
  processDay(league, random)
}
