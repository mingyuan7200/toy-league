import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { COUNTRY_NAMES } from '../functions/_data/countries.js'
import { newLeague, nextDay, nextGameDay, nextEntries, pendingGames, submitResult, SIZES, GROUPS } from '../functions/_league/engine.js'
import { addDays, doubleElimination, roundRobin, spreadDates } from '../functions/_league/formats.js'
import { allocation, simulate } from '../shared/blotto.js'

globalThis.crypto ??= webcrypto
const countries = COUNTRY_NAMES.map((name, index) => ({ id: index + 1, name }))
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 } }
function finishHumans(league, random) {
  while (pendingGames(league).length) {
    const game = pendingGames(league)[0]
    const result = simulate(random)
    submitResult(league, game.id, result.redScore, result.blueScore, random)
  }
}

test('calendar preserves years below 100, leap days, and ordered schedule windows', () => {
  assert.equal(addDays('0001-12-31', 1), '0002-01-01')
  assert.equal(addDays('0004-02-28', 1), '0004-02-29')
  assert.equal(addDays('0100-02-28', 1), '0100-03-01')
  const dates = spreadDates('0001-01-01', '0001-10-31', 20, new Set(['0001-01-01']))
  assert.equal(new Set(dates).size, 20)
  assert.ok(!dates.includes('0001-01-01'))
  assert.deepEqual([...dates].sort(), dates)
})

test('round robin covers every pair exactly once; random allocations spend every stone', () => {
  const rounds = roundRobin(Array.from({ length: 70 }, (_, i) => i + 1))
  assert.equal(rounds.length, 69)
  const pairs = rounds.flat().map(pair => pair.sort((a, b) => a - b).join(':'))
  assert.equal(new Set(pairs).size, 70 * 69 / 2)
  for (const total of [100, 112]) {
    const piles = allocation(total, 15, rng(total))
    assert.equal(piles.length, 15)
    assert.equal(piles.reduce((a, b) => a + b), total)
  }
})

test('50-player double elimination has exactly 14 first-round byes', () => {
  const graph = doubleElimination(Array.from({ length: 50 }, (_, i) => i + 1))
  const first = graph.filter(node => node.id.startsWith('W1-'))
  assert.equal(first.filter(node => node.sources.includes(null)).length, 14)
  assert.ok(first.every(node => !node.sources.every(s => s === null)))
  for (const node of graph) for (const source of node.sources) {
    if (source?.match) assert.ok(graph.find(n => n.id === source.match).depth < node.depth)
  }
})

test('new league: all countries once, China bottom, partial RR 20 games, reversed A colors', () => {
  const league = newLeague(countries, rng(12))
  assert.equal(league.date, '0001-01-01')
  for (const t of league.tournaments) {
    assert.equal(new Set(t.entries.map(e => e.countryId)).size, 195)
    GROUPS[t.type].forEach((group, i) => assert.equal(t.entries.filter(e => e.group === group).length, SIZES[t.type][i]))
  }
  const a = league.tournaments[0], b = league.tournaments[1]
  assert.equal(a.entries.find(e => e.countryId === league.humanId).startingRank, 70)
  assert.equal(b.entries.find(e => e.countryId === league.humanId).group, '6')
  assert.ok(b.entries.every(e => e.startingRank === null))
  for (const group of ['D', 'E', 'F']) for (const entry of a.entries.filter(e => e.group === group)) {
    assert.equal(a.matches.filter(m => m.sources.includes(entry.countryId)).length, 20)
  }
  const groupA = a.matches.filter(m => m.group === 'A')
  assert.equal(groupA.length, 90)
  for (const m of groupA) assert.ok(groupA.some(other => other.sources[0] === m.sources[1] && other.sources[1] === m.sources[0]))
})

test('human games block next day; result retries are idempotent and scores validated', () => {
  const random = rng(33), league = newLeague(countries, random)
  while (!pendingGames(league).length) nextDay(league, random)
  assert.throws(() => nextDay(league, random), /Finish all/)
  assert.throws(() => nextGameDay(league, random), /Finish all/)
  const game = pendingGames(league)[0]
  assert.throws(() => submitResult(league, game.id, 10, 10), /adding up to 15/)
  assert.throws(() => submitResult(league, game.id, 7.5, 7.5), /integers/)
  submitResult(league, game.id, 8, 7, random)
  const snapshot = JSON.stringify(league)
  submitResult(league, game.id, 8, 7, random)
  assert.equal(JSON.stringify(league), snapshot)
  assert.throws(() => submitResult(league, game.id, 7, 8), /different result/)
})

test('next game day equals daily processing and stops at AI-only or human games', () => {
  const league = newLeague(countries, rng(62))
  finishHumans(league, rng(77))
  const jumped = JSON.parse(JSON.stringify(league)), daily = JSON.parse(JSON.stringify(league))
  const random = rng(81)
  nextGameDay(jumped, rng(81))
  do { nextDay(daily, random) } while (!pendingGames(daily).length && !daily.tournaments.some(t => t.matches.some(m => m.date === daily.date && m.status === 'finished')))
  assert.deepEqual(jumped, daily)
  assert.ok(jumped.date > '0001-01-02', 'Empty days should be processed in one action')

  const aiOnly = JSON.parse(JSON.stringify(league))
  aiOnly.humanId = -1
  nextGameDay(aiOnly, rng(81))
  assert.equal(aiOnly.date, jumped.date, 'AI-only game days must not be skipped')
  assert.ok(aiOnly.tournaments.some(t => t.matches.some(m => m.date === aiOnly.date && m.status === 'finished')))
})

test('next game day creates the new season across the year boundary', () => {
  const random = rng(86), league = newLeague(countries, random)
  while (league.date < '0001-12-31') { finishHumans(league, random); nextDay(league, random) }
  finishHumans(league, random)
  nextGameDay(league, random)
  assert.ok(league.tournaments.some(t => t.type === 'A' && t.year === 2 && t.status === 'active'))
  assert.ok(league.date >= '0002-01-01')
})

test('B champion replacement preserves sizes for champions from every group', () => {
  const league = newLeague(countries, rng(50)), t = league.tournaments[1]
  GROUPS.B.forEach(group => t.entries.filter(e => e.group === group).forEach((entry, i) => { entry.finalRank = i + 1 }))
  for (const group of GROUPS.B) {
    t.winnerId = t.entries.find(e => e.group === group && e.finalRank === 1).countryId
    const entries = nextEntries(t)
    assert.equal(new Set(entries.map(e => e.countryId)).size, 195)
    GROUPS.B.forEach((g, i) => assert.equal(entries.filter(e => e.group === g).length, SIZES.B[i]))
    assert.equal(entries.find(e => e.countryId === t.defenderId).group, '1')
    assert.equal(entries.find(e => e.countryId === t.winnerId).group, '0')
  }
})

test('A orders relegated, retained, promoted countries, and puts defeated champion first', () => {
  const t = newLeague(countries, rng(57)).tournaments[0]
  GROUPS.A.forEach(group => t.entries.filter(e => e.group === group).forEach((entry, i) => { entry.finalRank = i + 1 }))
  const country = (group, rank) => t.entries.find(e => e.group === group && e.finalRank === rank).countryId
  t.winnerId = country('A', 1)
  const next = nextEntries(t)
  const b = next.filter(e => e.group === 'B').map(e => e.countryId)
  assert.deepEqual(b, [country('A', 9), country('A', 10), ...Array.from({ length: 11 }, (_, i) => country('B', i + 3)), country('C', 1), country('C', 2), country('C', 3)])
  assert.equal(next.find(e => e.group === 'A' && e.startingRank === 1).countryId, t.defenderId)
  assert.equal(next.find(e => e.countryId === t.winnerId).group, 'S')
})

test('both double-elimination grand-final outcomes obey the reset rule', () => {
  const outcomes = new Set()
  for (let seed = 1; seed <= 8 && outcomes.size < 2; seed++) {
    const random = rng(seed), league = newLeague(countries, random)
    while (league.date < '0002-03-01') { finishHumans(league, random); nextDay(league, random) }
    const t = league.tournaments.find(t => t.type === 'B')
    const final = t.matches.find(m => m.bracket === 'GF')
    const reset = t.matches.find(m => m.bracket === 'RESET')
    const unbeatenFinalist = t.matches.find(m => m.id === final.sources[0].match).winnerId
    if (final.winnerId === unbeatenFinalist) assert.equal(reset.status, 'skipped')
    else assert.equal(reset.status, 'finished')
    outcomes.add(reset.status)
  }
  assert.deepEqual([...outcomes].sort(), ['finished', 'skipped'])
})

test('two overlapping seasons complete, Swiss histories are unique, and DE eliminates twice', () => {
  const random = rng(197), league = newLeague(countries, random)
  while (league.date < '0003-07-01') {
    finishHumans(league, random)
    nextDay(league, random)
  }
  const complete = league.tournaments.filter(t => t.status === 'finished')
  assert.equal(complete.length, 4)
  for (const t of complete) {
    assert.equal(new Set(t.entries.map(e => e.countryId)).size, 195)
    assert.ok(t.winnerId)
    assert.ok(t.completedDate <= t.endDate)
    const finals = t.matches.filter(m => m.stage === 'championship' && m.status === 'finished')
    assert.equal(finals.filter(m => m.winnerId === t.winnerId).length, 4)
    assert.ok(finals.length >= 4 && finals.length <= 7)
    const upcoming = nextEntries(t)
    GROUPS[t.type].forEach((g, i) => assert.equal(upcoming.filter(e => e.group === g).length, SIZES[t.type][i]))
    for (const m of t.matches.filter(m => m.status === 'finished')) {
      assert.notEqual(m.redId, m.blueId)
      assert.equal(m.redScore + m.blueScore, 15)
    }
    if (t.type === 'B') {
      for (const group of GROUPS.B.slice(0, 5)) {
        const entries = t.entries.filter(e => e.group === group)
        assert.equal(new Set(entries.map(e => e.history)).size, entries.length)
        assert.ok(entries.every(e => e.history.length === (group === '1' ? 4 : 5)))
        for (const game of t.matches.filter(m => m.group === group)) {
          const histories = game.sources.map(country => entries.find(e => e.countryId === country).history.slice(0, game.round - 1))
          assert.equal(histories[0], histories[1])
        }
      }
      const entries = t.entries.filter(e => e.group === '6')
      const champion = entries.find(e => e.finalRank === 1)
      assert.ok(champion.losses <= 1)
      assert.ok(entries.filter(e => e !== champion).every(e => e.losses === 2))
      assert.equal(t.matches.filter(m => m.stage === 'challenger').length, 10)
      const played = t.matches.filter(m => m.group === '6' && m.status === 'finished')
      assert.ok(played.length === 98 || played.length === 99)
    }
  }
})
