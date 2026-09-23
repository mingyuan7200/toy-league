import { useEffect, useRef, useState } from 'react'
import TotalNumberGame from './TotalNumberGame.jsx'
import LeagueTournament from './LeagueTournament.jsx'
import { countryLabel } from '../../shared/countryFlags.js'
import { cachedCountries, loadCountries } from '../data/countries.js'

async function api(path, body) {
  const response = await fetch(`/api/${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'Backend unavailable. Start the project with npm run dev:full.')
  return data
}

const stageName = stage => ({ groups: 'Group stage', challenger: 'Stage 2', championship: 'Championship' }[stage] || stage)

export default function LeaguePage({ onExit, startNew = false }) {
  const [league, setLeague] = useState(null)
  const [countries, setCountries] = useState(cachedCountries)
  const [savedLeagues, setSavedLeagues] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [group, setGroup] = useState('')
  const [playing, setPlaying] = useState(null)
  const [filter, setFilter] = useState('china')
  const [page, setPage] = useState(0)
  const creatingId = useRef(null)
  const inFlight = useRef(false)

  async function run(action) {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError('')
    try { await action() } catch (problem) { setError(problem.message) }
    finally { inFlight.current = false; setBusy(false) }
  }

  useEffect(() => {
    let active = true
    api('league').then(data => { if (active) setSavedLeagues(data.leagues) }).catch(problem => { if (active) setError(problem.message) })
    return () => { active = false }
  }, [])

  const accept = data => {
    setLeague(data)
    try { localStorage.setItem('toy-league:last-league', data.id) } catch { /* Resume is also available from D1. */ }
  }
  const create = () => run(async () => {
    setCountries(await loadCountries())
    creatingId.current ??= crypto.randomUUID()
    accept(await api('league', { id: creatingId.current }))
  })
  const resume = id => run(async () => {
    setCountries(await loadCountries())
    accept(await api(`league?id=${encodeURIComponent(id)}`))
  })
  const advance = () => run(async () => accept(await api('next-day', { leagueId: league.id, version: league.version })))
  const advanceToGame = () => run(async () => accept(await api('next-game-day', { leagueId: league.id, version: league.version })))
  const name = id => {
    const country = countries?.find(country => country.id === id)
    return country ? countryLabel(country.name) : 'To be decided'
  }
  const t = league?.tournaments.find(tournament => tournament.id === selected) || league?.tournaments.slice().reverse().find(tournament => tournament.status === 'active') || league?.tournaments.at(-1)

  useEffect(() => {
    if (!t) return
    const own = t.entries.find(entry => entry.countryId === league.humanId)?.group
    setGroup(t.standings[own] ? own : Object.keys(t.standings)[0])
    setPage(0)
  }, [t?.id])

  const complete = scores => run(async () => {
    const updated = await api('game-result', { leagueId: league.id, version: league.version, gameId: playing.id, ...scores })
    accept(updated)
    try { localStorage.removeItem(`toy-league:game:${league.id}:${playing.id}`) } catch { /* Submitted result is already safe in D1. */ }
    setPlaying(null)
  })

  if (playing) return <TotalNumberGame key={playing.id} leagueGame={{
    playerColor: playing.redId === league.humanId ? 'red' : 'blue',
    opponentName: name(playing.redId === league.humanId ? playing.blueId : playing.redId),
    storageKey: `toy-league:game:${league.id}:${playing.id}`,
    label: `${playing.tournamentType} · ${playing.date} · ${stageName(playing.stage)}`,
  }} onExit={() => { setPlaying(null); setError('') }} onComplete={complete} saving={busy} saveError={error} />

  const scheduled = t?.matches.filter(m => filter === 'china'
    ? [m.redId, m.blueId, ...m.participants].includes(league.humanId)
    : filter === 'group' ? m.group === group : true).sort((a, b) => a.date.localeCompare(b.date)) || []
  const today = league?.tournaments.flatMap(tournament => tournament.matches.filter(m => m.date === league.date && m.status === 'finished').map(m => ({ ...m, type: tournament.type }))) || []

  return <main className="screen league-screen"><section className="league-shell">
    <header className="game-header">
      <button className="back-button" onClick={onExit} disabled={busy} aria-label="Back to main menu">←</button>
      <div><p className="eyebrow">You play as 🇨🇳 China</p><h1>{league ? 'Your league' : startNew ? 'Start a league' : 'Resume a league'}</h1></div>
      {league && <button className="league-secondary" disabled={busy} onClick={() => resume(league.id)}>Reload</button>}
    </header>
    {error && <p className="league-error" role="alert">{error} {league && 'Use Reload to fetch the latest saved state.'}</p>}
    {!league ? <>
      {startNew && <section className="league-panel">
        <h2>A world of 195 countries</h2>
        <p>Start on 0001-01-01. Compete as China in two annual tournaments, beginning in their lowest groups. Each game has 15 rounds, with 100 red stones and 112 blue stones.</p>
        <p>Existing leagues remain available to resume.</p>
        <button className="restart-button" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create league'}</button>
      </section>}
      <section className="league-panel"><h2>Saved leagues</h2>
        {!savedLeagues.length && <p>No saved leagues found.</p>}
        {savedLeagues.map(saved => <button className="league-save" key={saved.id} disabled={busy} onClick={() => resume(saved.id)}>
          <strong>Game date {saved.date}</strong><small>Save {saved.id.slice(0, 8)} · created {saved.createdAt}</small><span>Resume →</span>
        </button>)}
      </section>
    </> : <>
      <section className="league-calendar league-panel">
        <div><p className="eyebrow">Game date</p><strong>{league.date}</strong><p>{league.pending.length ? `${league.pending.length} China game(s) to finish today` : 'Today is complete. You can advance.'}</p></div>
        <div className="league-advance-controls">
          <button className="restart-button" disabled={busy || league.pending.length > 0} onClick={advanceToGame}>{busy ? 'Processing…' : 'Next game day →'}</button>
          <button className="league-secondary" disabled={busy || league.pending.length > 0} onClick={advance}>Next day →</button>
          <small>Next game day stops at any country’s next game.</small>
        </div>
      </section>
      {league.pending.length > 0 && <section className="league-panel"><h2>Your games today</h2>
        {league.pending.map(game => <div className="league-fixture" key={game.id}>
          <div><strong>🇨🇳 China vs {name(game.redId === league.humanId ? game.blueId : game.redId)}</strong><small>Tournament {game.tournamentType} · {stageName(game.stage)} {game.group && `· Group ${game.group}`} · You are {game.redId === league.humanId ? 'red' : 'blue'}</small></div>
          <button className="restart-button" disabled={busy} onClick={() => { setError(''); setPlaying(game) }}>Play / resume</button>
        </div>)}
      </section>}
      <section className="league-panel">
        <label className="league-label" htmlFor="league-tournament">Tournament</label>
        <select id="league-tournament" value={t?.id || ''} onChange={event => { setSelected(event.target.value); setPage(0) }}>
          {league.tournaments.map(tournament => <option key={tournament.id} value={tournament.id}>{tournament.type} · Season {tournament.year} · {tournament.status}</option>)}
        </select>
        {t && <LeagueTournament key={t.id} t={t} group={group} setGroup={value => { setGroup(value); setPage(0) }} name={name} humanId={league.humanId} date={league.date} />}
      </section>
      <section className="league-panel"><h2>Schedule and results</h2>
        <label className="league-label" htmlFor="league-filter">Show games</label>
        <select id="league-filter" value={filter} onChange={event => { setFilter(event.target.value); setPage(0) }}><option value="china">China’s games</option><option value="group">Selected group</option><option value="all">All tournament games</option></select>
        <p className="league-note">Future Swiss pairings and later stages appear as earlier stages finish. Knockout opponents are filled in when their match day arrives.</p>
        <div className="league-table-wrap"><table><thead><tr><th>Date</th><th>Stage</th><th>Red</th><th>Score</th><th>Blue</th><th>Status</th></tr></thead><tbody>
          {scheduled.slice(page * 40, page * 40 + 40).map(game => <tr key={game.id} className={game.date === league.date ? 'league-you' : ''}>
            <td>{game.date}</td><td>{stageName(game.stage)} {game.group || game.bracket || ''}{game.stage === 'championship' && ` · Game ${game.round}`}</td>
            <td className={game.winnerId && game.winnerId === game.redId ? 'league-winner' : ''}>{name(game.redId ?? game.participants[0])}{!game.redId && !game.fixedColors && game.participants[0] && <small> (color TBD)</small>}</td>
            <td>{game.status === 'finished' ? `${game.redScore}–${game.blueScore}` : '—'}</td>
            <td className={game.winnerId && game.winnerId === game.blueId ? 'league-winner' : ''}>{name(game.blueId ?? game.participants[1])}{!game.blueId && !game.fixedColors && game.participants[1] && <small> (color TBD)</small>}</td><td>{game.status}</td>
          </tr>)}
        </tbody></table></div>
        {!scheduled.length && <p>No games have been scheduled for this selection yet.</p>}
        <div className="league-pagination"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{scheduled.length} games · Page {page + 1}</span><button disabled={(page + 1) * 40 >= scheduled.length} onClick={() => setPage(page + 1)}>Next</button></div>
      </section>
      <details className="league-panel"><summary>Today’s completed games ({today.length})</summary>
        {today.map(game => <p key={game.id}>{game.type}: {name(game.redId)} {game.redScore}–{game.blueScore} {name(game.blueId)} · Winner: {name(game.winnerId)}</p>)}
      </details>
    </>}
  </section></main>
}
