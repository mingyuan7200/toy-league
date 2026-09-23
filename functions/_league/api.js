import { ensureCountries } from '../api/countries.js'
import { ensureLeagueSchema, loadLeague, publicLeague, saveLeague } from './store.js'
import { newLeague, nextDay, nextGameDay, submitResult } from './engine.js'

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function leagueApi({ request, env }, action) {
  if (!env.DB) return json({ error: 'The database is unavailable. Use the full local server or the deployed site.' }, 503)
  try {
    if (action === 'create') await ensureCountries(env.DB)
    await ensureLeagueSchema(env.DB)
    const db = env.DB
    const url = new URL(request.url)
    const body = request.method === 'GET' ? {} : await request.json()
    if (action === 'list' && !url.searchParams.get('id')) {
      const { results } = await db.prepare('SELECT id, "current_date" AS date, created_at AS createdAt FROM League ORDER BY created_at DESC, rowid DESC').all()
      return json({ leagues: results })
    }
    if (action === 'create') {
      if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return json({ error: 'A valid new league ID is required.' }, 400)
      const existing = await db.prepare('SELECT id FROM League WHERE id = ?').bind(body.id).first()
      if (existing) {
        const loaded = await loadLeague(db, body.id)
        return json(publicLeague(loaded.league))
      }
      const { results: countries } = await db.prepare('SELECT id, name FROM Country ORDER BY id').all()
      const league = newLeague(countries)
      league.id = body.id
      await saveLeague(db, league, undefined, true)
      return json(publicLeague(league), 201)
    }
    const leagueId = action === 'list' ? url.searchParams.get('id') : body.leagueId
    if (typeof leagueId !== 'string') return json({ error: 'League ID is required.' }, 400)
    const { league, originals } = await loadLeague(db, leagueId)
    if (action !== 'list') {
      // Identical result retries remain successful even after the calendar advances.
      if (action === 'result') {
        const existing = league.tournaments.flatMap(t => t.matches).find(m => m.id === body.gameId)
        if (existing?.status === 'finished' && existing.redScore === body.redScore && existing.blueScore === body.blueScore && [existing.redId, existing.blueId].includes(league.humanId)) return json(publicLeague(league))
      }
      if (body.version !== league.version) return json({ error: 'League changed in another tab. Reload and try again.' }, 409)
      if (action === 'next') nextDay(league)
      else if (action === 'next-game') nextGameDay(league)
      else if (action === 'result') submitResult(league, body.gameId, body.redScore, body.blueScore)
      await saveLeague(db, league, originals)
    }
    return json(publicLeague(league))
  } catch (error) {
    console.error('League request failed', error)
    return json({ error: error.message || 'Unable to load the league.' }, error.message.includes('another tab') ? 409 : 400)
  }
}
