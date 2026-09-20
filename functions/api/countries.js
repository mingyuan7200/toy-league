import { COUNTRY_NAMES } from '../_data/countries.js'

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', ...init.headers },
})

async function ensureCountries(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS Country (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )
  `).run()

  const { count } = await db.prepare('SELECT COUNT(*) AS count FROM Country').first()
  if (count === COUNTRY_NAMES.length) return

  await db.batch(COUNTRY_NAMES.map((name, index) => (
    db.prepare('INSERT OR REPLACE INTO Country (id, name) VALUES (?, ?)').bind(index + 1, name)
  )))
}

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return json({ error: 'The GPT Sites D1 database is not configured.' }, { status: 503 })
  }

  try {
    await ensureCountries(env.DB)
    const { results } = await env.DB.prepare('SELECT id, name FROM Country ORDER BY id').all()
    return json({ countries: results })
  } catch (error) {
    console.error('Unable to load countries', error)
    return json({ error: 'Unable to load countries from the database.' }, { status: 500 })
  }
}
