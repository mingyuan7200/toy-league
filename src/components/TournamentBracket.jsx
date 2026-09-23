import { useEffect, useState } from 'react'
import { bracketLayout, isSettled, matchLabel, roundsFor, sourceSlot } from '../game/bracketView.js'

function MatchCard({ game, allGames, name, humanId, date }) {
  const slots = (game.sources || game.participants || []).map(source => sourceSlot(source, allGames))
  const yours = slots.some(slot => slot.countryId === humanId)
  const status = game.status === 'bye' ? 'Bye · automatic advancement' : game.status === 'skipped' ? 'Not needed' : game.status === 'finished' ? 'Final result' : game.date <= date ? 'Due today' : 'Scheduled'
  return <article className={`bracket-match ${yours ? 'bracket-china' : ''} ${isSettled(game) ? 'bracket-settled' : ''}`} aria-label={`${matchLabel(game)}, ${status}`}>
    <header><strong>{matchLabel(game)}</strong><time>{game.date}</time></header>
    {slots.map((slot, i) => <div key={i} className={`bracket-player ${slot.countryId && slot.countryId === game.winnerId ? 'bracket-victor' : ''}`}>
      <span title={slot.countryId ? name(slot.countryId) : slot.label}>{slot.countryId ? name(slot.countryId) : slot.label}{slot.countryId === humanId && <small> · You</small>}</span>
      <b>{game.status === 'finished' && slot.countryId ? (slot.countryId === game.redId ? game.redScore : game.blueScore) : slot.countryId && slot.countryId === game.winnerId ? '✓' : '—'}</b>
    </div>)}
    <footer>{status}</footer>
  </article>
}

export default function TournamentBracket({ games, allGames, kind, title, name, humanId, date }) {
  const rounds = roundsFor(games, kind)
  const firstOpen = rounds.findIndex(round => round.games.some(game => !isSettled(game)))
  const current = firstOpen < 0 ? Math.max(0, rounds.length - 1) : firstOpen
  const [roundIndex, setRoundIndex] = useState(current)
  const [full, setFull] = useState(false)
  useEffect(() => { setRoundIndex(current) }, [current, kind])
  if (!rounds.length) return <p>This bracket has not been scheduled yet.</p>
  const index = Math.min(roundIndex, rounds.length - 1)
  const layout = bracketLayout(rounds)
  const card = game => <MatchCard game={game} allGames={allGames} name={name} humanId={humanId} date={date} />
  const edges = games.flatMap(game => (game.sources || []).flatMap((source, slot) => {
    const from = layout.positions.get(source?.match), to = layout.positions.get(game.id)
    if (!from || !to) return []
    const x1 = from.x + layout.width, y1 = from.y + layout.height / 2
    const x2 = to.x, y2 = to.y + 65 + slot * 48
    return [<path key={`${game.id}-${slot}`} d={`M ${x1} ${y1} H ${x2 - 18} V ${y2} H ${x2}`} className={source.outcome === 'loser' ? 'bracket-loss-link' : ''} />]
  }))
  return <section className={`tournament-bracket ${full ? 'show-full-bracket' : ''}`} aria-label={title}>
    <h3>{title}</h3>
    <p className="league-note">{games.filter(game => game.status === 'finished').length} games played · {firstOpen < 0 ? 'Complete' : `Current: ${rounds[current].title}`}. Gold marks winners; China is outlined.</p>
    <div className="bracket-mobile-controls">
      <label>Round <select value={index} onChange={event => setRoundIndex(Number(event.target.value))}>{rounds.map((round, i) => <option value={i} key={round.order}>{round.title}</option>)}</select></label>
      <div className="bracket-round-buttons"><button disabled={index === 0} onClick={() => setRoundIndex(index - 1)}>← Previous</button><button disabled={index === rounds.length - 1} onClick={() => setRoundIndex(index + 1)}>Next →</button></div>
      <button aria-pressed={full} onClick={() => setFull(!full)}>{full ? 'Show one round' : 'Show full bracket'}</button>
    </div>
    <div className="bracket-mobile-round"><h4>{rounds[index].title}</h4>{rounds[index].games.map(game => <div key={game.id}>{card(game)}</div>)}</div>
    <div className="bracket-scroll" tabIndex="0" role="region" aria-label={`${title}, scroll horizontally for later rounds`}>
      <div className="bracket-round-headings" style={{ width: layout.totalWidth, gridTemplateColumns: `repeat(${rounds.length}, ${layout.width}px)`, gap: layout.gap }}>{rounds.map(round => <h4 key={round.order}>{round.title}</h4>)}</div>
      <div className="bracket-canvas" style={{ width: layout.totalWidth, height: layout.totalHeight }}>
        <svg width={layout.totalWidth} height={layout.totalHeight} aria-hidden="true">{edges}</svg>
        {games.map(game => <div key={game.id} className="bracket-position" style={{ left: layout.positions.get(game.id).x, top: layout.positions.get(game.id).y, width: layout.width, height: layout.height }}>{card(game)}</div>)}
      </div>
    </div>
  </section>
}
