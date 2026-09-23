// Start Wrangler with --persist-to .wrangler/league-test --port 8790 first.
// This creates one disposable league in that isolated test database.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const base = 'http://127.0.0.1:8790'
async function request(path, body) {
  const response = await fetch(`${base}/api/${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  return { status: response.status, body: await response.json() }
}
const id = randomUUID()
const created = await request('league', { id })
assert.equal(created.status, 201, JSON.stringify(created.body))
let league = created.body
assert.equal('countries' in league, false)
assert.equal((await request('countries')).body.countries.length, 195)
assert.equal(league.tournaments.length, 2)
assert.equal(league.date, '0001-01-01')
assert.equal((await request('league', { id })).body.id, id)
assert.ok((await request('league')).body.leagues.some(saved => saved.id === id && saved.date === '0001-01-01'))

while (!league.pending.length) {
  const next = await request('next-day', { leagueId: id, version: league.version })
  assert.equal(next.status, 200, JSON.stringify(next.body))
  league = next.body
}
const blocked = await request('next-day', { leagueId: id, version: league.version })
assert.equal(blocked.status, 400)
assert.equal((await request('next-game-day', { leagueId: id, version: league.version })).status, 400)
const game = league.pending[0]
assert.equal((await request('game-result', { leagueId: id, version: league.version, gameId: game.id, redScore: 9, blueScore: 9 })).status, 400)
const result = { leagueId: id, version: league.version, gameId: game.id, redScore: 8, blueScore: 7 }
const finished = await request('game-result', result)
assert.equal(finished.status, 200, JSON.stringify(finished.body))
league = finished.body
assert.equal((await request('game-result', result)).body.version, league.version)
assert.equal((await request('game-result', { ...result, version: league.version, redScore: 7, blueScore: 8 })).status, 400)
while (league.pending.length) {
  const game = league.pending[0]
  league = (await request('game-result', { leagueId: id, version: league.version, gameId: game.id, redScore: 8, blueScore: 7 })).body
}
const oldVersion = league.version
const concurrent = await Promise.all([
  request('next-day', { leagueId: id, version: oldVersion }),
  request('next-day', { leagueId: id, version: oldVersion }),
])
assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409])
const loaded = await request(`league?id=${id}`)
assert.equal(loaded.body.version, oldVersion + 1)
const storedGame = loaded.body.tournaments.flatMap(t => t.matches).find(m => m.id === game.id)
assert.equal(storedGame.status, 'finished')
assert.equal(storedGame.redScore, 8)
assert.equal(storedGame.blueScore, 7)
assert.ok(!JSON.stringify(loaded.body).includes('opponentPiles'))
assert.equal('countries' in loaded.body, false)
const jumped = await request('next-game-day', { leagueId: id, version: loaded.body.version })
assert.equal(jumped.status, 200, JSON.stringify(jumped.body))
assert.equal(jumped.body.version, loaded.body.version + 1)
assert.ok(jumped.body.date > loaded.body.date)
assert.ok(jumped.body.pending.length || jumped.body.tournaments.some(t => t.matches.some(m => m.date === jumped.body.date && m.status === 'finished')))
assert.equal('countries' in jumped.body, false)
console.log(`PASS: D1 league ${id}; persisted final score; blocked unfinished day; idempotent retries; concurrent advance rejected; no AI allocation stored.`)
