import { Fragment, useEffect, useState } from 'react'
import TournamentBracket from './TournamentBracket.jsx'
import { aBoundaries, currentStage } from '../game/bracketView.js'

function Standings({ t, group, humanId, name }) {
  const entries = t.standings[group] || []
  const boundaries = t.type === 'A' ? aBoundaries(group, entries.length) : []
  return <>
    <p className="league-note">{t.type === 'A' ? 'Ties use starting rank. Promoted countries enter the bottom of their new group.' : group === '6' ? 'Two losses eliminate a country; top four are promoted. Equal elimination finishes use a random tie order.' : 'Paired by identical results. Ties use earlier wins first.'} {t.stageOneFinished ? 'Group results are final.' : 'Positions and qualification zones are provisional.'}</p>
    <div className="league-table-wrap"><table><thead><tr><th>Rank</th><th>Country</th><th>W</th><th>L</th><th>{t.type === 'A' ? 'Seed' : 'History'}</th><th>Next group</th></tr></thead><tbody>
      {entries.map((entry, index) => <Fragment key={entry.countryId}>
        <tr className={entry.countryId === humanId ? 'league-you' : ''}>
          <td>{entry.finalRank || index + 1}</td><th scope="row">{name(entry.countryId)}{entry.countryId === humanId ? ' (You)' : ''}</th><td>{entry.wins}</td><td>{entry.losses}</td><td>{t.type === 'A' ? entry.startingRank : entry.history || '—'}</td><td>{entry.nextGroup || '—'}{entry.nextRank ? ` · ${entry.nextRank}` : ''}</td>
        </tr>
        {boundaries.filter(boundary => boundary.after === index + 1).map(boundary => <tr className={`standings-boundary boundary-${boundary.kind}`} key={boundary.kind}><td colSpan="6">{boundary.label} · {t.stageOneFinished ? 'Final' : 'Provisional'}</td></tr>)}
      </Fragment>)}
    </tbody></table></div>
  </>
}

function DoubleElimination({ t, name, humanId, date }) {
  const [bracket, setBracket] = useState('winners')
  const games = t.matches.filter(game => game.group === '6')
  const selected = games.filter(game => bracket === 'winners' ? game.bracket?.startsWith('W') : bracket === 'losers' ? game.bracket?.startsWith('L') : ['GF', 'RESET'].includes(game.bracket))
  const own = t.entries.find(entry => entry.countryId === humanId && entry.group === '6')
  return <div className="double-elimination">
    <h3>Group 6 · Double elimination</h3>
    <p className="league-note">First loss → losers bracket. Second loss → eliminated. The two bracket winners meet in the grand final; a reset is played only if the undefeated finalist loses. Byes advance automatically.</p>
    {own && <p className="bracket-human-status">China: {own.losses >= 2 ? 'Eliminated (2 losses)' : own.finalRank === 1 ? 'Group winner' : own.losses === 1 ? 'Losers bracket · 1 loss' : 'Winners bracket · unbeaten'}</p>}
    <div className="league-tabs" aria-label="Group 6 bracket"><button aria-pressed={bracket === 'winners'} onClick={() => setBracket('winners')}>Winners bracket</button><button aria-pressed={bracket === 'losers'} onClick={() => setBracket('losers')}>Losers bracket</button><button aria-pressed={bracket === 'finals'} onClick={() => setBracket('finals')}>Final / reset</button></div>
    <TournamentBracket key={bracket} games={selected} allGames={t.matches} kind={bracket} title={{ winners: 'Winners bracket', losers: 'Losers bracket', finals: 'Group 6 final / reset' }[bracket]} name={name} humanId={humanId} date={date} />
  </div>
}

function Championship({ t, name, humanId }) {
  const games = t.matches.filter(game => game.stage === 'championship')
  if (!games.length) return <p>The best-of-seven championship will be scheduled when the challenger is decided.</p>
  const score = countryId => games.filter(game => game.winnerId === countryId && game.status === 'finished').length
  return <section className="championship-panel" aria-label="Championship">
    <h2>Championship · Best of seven</h2>
    <div className="championship-score"><strong>{name(t.defenderId)}</strong><b>{score(t.defenderId)}–{score(t.challengerId)}</b><strong>{name(t.challengerId)}</strong></div>
    <p>First to four wins. {t.winnerId ? `Champion: ${name(t.winnerId)} · awarded ${t.completedDate}` : 'Red and blue alternate each game.'}</p>
    <div className="championship-games">{games.map(game => <article className={`championship-game ${game.winnerId === humanId ? 'league-you' : ''}`} key={game.id}>
      <strong>Game {game.round}</strong><time>{game.date}</time>
      <span>{game.status === 'skipped' ? 'Not needed' : game.status === 'finished' ? `${name(game.redId)} ${game.redScore}–${game.blueScore} ${name(game.blueId)}` : 'Scheduled'}</span>
      {game.winnerId && <small>Winner: {name(game.winnerId)}</small>}
    </article>)}</div>
  </section>
}

export default function LeagueTournament({ t, group, setGroup, name, humanId, date }) {
  const active = currentStage(t)
  const [stage, setStage] = useState(active)
  useEffect(() => { setStage(active) }, [active])
  const groupView = <>
    <label className="league-label" htmlFor="league-group">Group</label>
    <select id="league-group" value={group} onChange={event => setGroup(event.target.value)}>{Object.keys(t.standings).map(key => <option key={key} value={key}>Group {key}</option>)}</select>
    {t.type === 'B' && group === '6' && <DoubleElimination t={t} name={name} humanId={humanId} date={date} />}
    <h3>Group {group} standings</h3>
    <Standings t={t} group={group} name={name} humanId={humanId} />
  </>
  return <>
    <p>{t.startDate} – {t.endDate}</p>
    <p>Defending champion: <strong>{name(t.defenderId)}</strong></p>
    {t.winnerId && <p className="league-champion">★ Champion: {name(t.winnerId)} · awarded {t.completedDate}</p>}
    <div className="league-tabs stage-tabs" aria-label="Tournament stage">
      <button aria-pressed={stage === 'groups'} onClick={() => setStage('groups')}>Group stage{active === 'groups' ? ' · Current' : ''}</button>
      {t.type === 'B' && <button aria-pressed={stage === 'challenger'} onClick={() => setStage('challenger')}>Stage 2{active === 'challenger' ? ' · Current' : ''}</button>}
      <button aria-pressed={stage === 'championship'} onClick={() => setStage('championship')}>Championship{active === 'championship' ? t.winnerId ? ' · Complete' : ' · Current' : ''}</button>
    </div>
    {stage === 'groups' && groupView}
    {stage === 'challenger' && <TournamentBracket games={t.matches.filter(game => game.stage === 'challenger')} allGames={t.matches} kind="challenger" title="Stage 2 · Challenger knockout" name={name} humanId={humanId} date={date} />}
    {stage === 'championship' && <Championship t={t} name={name} humanId={humanId} />}
    {stage !== 'groups' && <details className="past-group-results"><summary>{t.stageOneFinished ? 'Completed group standings and brackets' : 'Group standings and brackets'}</summary>{groupView}</details>}
  </>
}
