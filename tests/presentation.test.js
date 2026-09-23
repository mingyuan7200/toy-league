import test from 'node:test'
import assert from 'node:assert/strict'
import { COUNTRY_NAMES } from '../functions/_data/countries.js'
import { COUNTRY_CODES, flagFor } from '../shared/countryFlags.js'
import { aBoundaries, bracketLayout, currentStage, roundsFor, sourceSlot } from '../src/game/bracketView.js'
import { doubleElimination } from '../functions/_league/formats.js'

test('flags cover all countries, including both observers', () => {
  assert.equal(Object.keys(COUNTRY_CODES).length, 195)
  assert.equal(new Set(Object.values(COUNTRY_CODES)).size, 195)
  for (const name of COUNTRY_NAMES) assert.match(COUNTRY_CODES[name], /^[A-Z]{2}$/)
  assert.equal(flagFor("China (the People's Republic of)"), '🇨🇳')
  assert.equal(flagFor('Holy See'), '🇻🇦')
  assert.equal(flagFor('State of Palestine'), '🇵🇸')
  assert.equal(flagFor('Zimbabwe'), '🇿🇼')
})

test('stage focus and A qualification boundaries follow the tournament rules', () => {
  assert.equal(currentStage({ type: 'B', stageOneFinished: true }), 'challenger')
  assert.equal(currentStage({ type: 'B', challengerId: 22 }), 'championship')
  assert.equal(currentStage({ type: 'A' }), 'groups')
  assert.deepEqual(aBoundaries('D', 30).map(b => b.after), [4, 25])
  assert.deepEqual(aBoundaries('A', 10).map(b => b.after), [1, 8])
  assert.deepEqual(aBoundaries('F', 70).map(b => b.after), [6])
})

test('bracket sources distinguish winners, losers, undecided slots, and byes', () => {
  const parent = { id: 'parent', bracket: 'W2-0', status: 'scheduled' }
  assert.deepEqual(sourceSlot({ match: 'parent', outcome: 'loser' }, [parent]), { label: 'Loser of W2-1' })
  parent.status = 'finished'; parent.winnerId = 10; parent.loserId = 20
  assert.deepEqual(sourceSlot({ match: 'parent', outcome: 'winner' }, [parent]), { countryId: 10 })
  assert.deepEqual(sourceSlot({ match: 'parent', outcome: 'loser' }, [parent]), { countryId: 20 })
  parent.status = 'bye'; parent.loserId = null
  assert.equal(sourceSlot({ match: 'parent', outcome: 'loser' }, [parent]).bye, true)
})

test('double-elimination layout has six winners rounds, ten losers rounds and no overlapping cards', () => {
  const graph = doubleElimination(Array.from({ length: 50 }, (_, i) => i + 1)).map(node => ({ ...node, bracket: node.id }))
  for (const [kind, prefix, count] of [['winners', 'W', 6], ['losers', 'L', 10]]) {
    const rounds = roundsFor(graph.filter(g => g.bracket.startsWith(prefix)), kind)
    assert.equal(rounds.length, count)
    const { positions, height } = bracketLayout(rounds)
    for (const round of rounds) {
      const tops = round.games.map(g => positions.get(g.id).y).sort((a, b) => a - b)
      for (let i = 1; i < tops.length; i++) assert.ok(tops[i] - tops[i - 1] >= height)
    }
  }
})
