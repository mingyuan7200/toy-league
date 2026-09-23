import { standings, pendingGames } from './engine.js'

// A season document keeps bracket dependencies, entries and results together.
// Game/TournamentEntry views expose those records to ordinary SQL queries.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS League (
    id TEXT PRIMARY KEY, current_date TEXT NOT NULL, human_country_id INTEGER NOT NULL REFERENCES Country(id),
    version INTEGER NOT NULL DEFAULT 0, write_token TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS Tournament (
    uuid TEXT PRIMARY KEY, league_id TEXT NOT NULL REFERENCES League(id), type TEXT NOT NULL,
    starting_year INTEGER NOT NULL, starting_date TEXT NOT NULL, end_date TEXT NOT NULL,
    state TEXT NOT NULL, data_json TEXT NOT NULL, UNIQUE(league_id, type, starting_year)
  )`,
  `CREATE VIEW IF NOT EXISTS Game AS SELECT
    json_extract(g.value, '$.id') AS uuid, t.league_id, t.uuid AS tournament_uuid,
    json_extract(g.value, '$.redId') AS red_player, json_extract(g.value, '$.blueId') AS blue_player,
    json_extract(g.value, '$.winnerId') AS winner, json_extract(g.value, '$.redScore') AS red_score,
    json_extract(g.value, '$.blueScore') AS blue_score, json_extract(g.value, '$.date') AS game_date,
    json_extract(g.value, '$.status') AS state, json_extract(g.value, '$.stage') AS stage,
    json_extract(g.value, '$.group') AS group_name, json_extract(g.value, '$.bracket') AS bracket
    FROM Tournament t, json_each(t.data_json, '$.matches') g`,
  `CREATE VIEW IF NOT EXISTS TournamentEntry AS SELECT
    t.uuid AS tournament_uuid, t.league_id, json_extract(e.value, '$.countryId') AS country_id,
    json_extract(e.value, '$.group') AS group_name, json_extract(e.value, '$.startingRank') AS starting_rank,
    json_extract(e.value, '$.wins') AS wins, json_extract(e.value, '$.losses') AS losses,
    json_extract(e.value, '$.history') AS history, json_extract(e.value, '$.finalRank') AS final_rank,
    json_extract(e.value, '$.nextGroup') AS next_group
    FROM Tournament t, json_each(t.data_json, '$.entries') e`,
]

export async function ensureLeagueSchema(db) {
  await db.batch(SCHEMA.map(sql => db.prepare(sql)))
}

export async function loadLeague(db, leagueId) {
  const [{ results: rows }, { results: tournaments }] = await db.batch([
    db.prepare('SELECT * FROM League WHERE id = ?').bind(leagueId),
    db.prepare('SELECT data_json FROM Tournament WHERE league_id = ? ORDER BY starting_year, type').bind(leagueId),
  ])
  if (!rows.length) throw new Error('League not found.')
  const row = rows[0]
  const docs = tournaments.map(t => JSON.parse(t.data_json))
  return {
    league: { id: row.id, date: row.current_date, humanId: row.human_country_id, version: row.version, countryIds: docs[0].entries.map(e => e.countryId), tournaments: docs },
    originals: new Map(tournaments.map((t, index) => [docs[index].id, t.data_json])),
  }
}

export async function saveLeague(db, league, originals = new Map(), creating = false) {
  const token = crypto.randomUUID()
  const guard = 'EXISTS (SELECT 1 FROM League WHERE id = ? AND write_token = ?)'
  const statements = [creating
    ? db.prepare('INSERT OR IGNORE INTO League (id, current_date, human_country_id, version, write_token) VALUES (?, ?, ?, 0, ?)').bind(league.id, league.date, league.humanId, token)
    : db.prepare('UPDATE League SET current_date = ?, version = version + 1, write_token = ? WHERE id = ? AND version = ?').bind(league.date, token, league.id, league.version)]
  for (const t of league.tournaments) {
    const data = JSON.stringify(t)
    if (originals.get(t.id) === data) continue
    statements.push(db.prepare(`INSERT INTO Tournament (uuid, league_id, type, starting_year, starting_date, end_date, state, data_json)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}
      ON CONFLICT(uuid) DO UPDATE SET state = excluded.state, data_json = excluded.data_json`)
      .bind(t.id, league.id, t.type, t.year, t.startDate, t.endDate, t.status, data, league.id, token))
  }
  // D1 batches are transactional. A unique write token guards every season write,
  // so a stale tab cannot partially save or advance a day twice.
  const results = await db.batch(statements)
  if (!results[0].meta.changes) throw new Error('League changed in another tab. Reload and try again.')
  if (!creating) league.version++
}

export function publicLeague(league) {
  return {
    id: league.id, date: league.date, humanId: league.humanId, version: league.version,
    pending: pendingGames(league),
    tournaments: league.tournaments.map(t => ({
      id: t.id, type: t.type, year: t.year, startDate: t.startDate, endDate: t.endDate,
      status: t.status, completedDate: t.completedDate, defenderId: t.defenderId,
      winnerId: t.winnerId, challengerId: t.challengerId, stageOneFinished: t.stageOneFinished,
      entries: t.entries,
      standings: Object.fromEntries((t.type === 'A' ? ['A', 'B', 'C', 'D', 'E', 'F'] : ['1', '2', '3', '4', '5', '6']).map(group => [group, standings(t, group)])),
      matches: t.matches.map(m => ({ ...m, participants: m.sources.map(s => typeof s === 'number' ? s : null) })),
    })),
  }
}
