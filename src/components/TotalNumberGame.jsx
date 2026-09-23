import { useEffect, useState } from 'react'
import { useTotalNumberMatch } from '../game/useTotalNumberMatch.js'

function ColorBadge({ color }) {
  return <span className={`color-badge ${color}`}>{color}</span>
}

export default function TotalNumberGame({ onExit, leagueGame, onComplete, saving = false, saveError = '' }) {
  const match = useTotalNumberMatch(leagueGame ? {
    playerColor: leagueGame.playerColor,
    redStones: 100,
    blueStones: 112,
    storageKey: leagueGame.storageKey,
  } : undefined)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setAmount('')
    setError('')
  }, [match.history.length])

  const submitPlay = (event) => {
    event.preventDefault()
    const stones = match.isFinalRound ? match.playerRemaining : Number(amount)
    if (!match.isFinalRound && (amount.trim() === '' || !Number.isInteger(stones))) {
      setError('Enter a whole number of stones.')
      return
    }
    if (stones < 0 || stones > match.playerRemaining) {
      setError(`Choose between 0 and ${match.playerRemaining}.`)
      return
    }
    match.play(stones)
  }

  const playerWon = match.playerScore > match.opponentScore
  const roleSummary = match.playerColor === 'red'
    ? 'You are Red. Equal plays score for you.'
    : 'You are Blue. You have extra stones, but equal plays score for Red.'

  return (
    <main className="screen game-screen">
      <section className="game-shell total-game-shell">
        <header className="game-header">
          <button className="back-button" disabled={saving} onClick={onExit} aria-label="Back">←</button>
          <div><p className="eyebrow">{leagueGame?.label || 'Total Number Game'}</p><h1>Round {match.round} <span>/ {match.rounds}</span></h1></div>
          <div className="header-spacer" aria-hidden="true" />
        </header>

        <p className="role-summary">{roleSummary}</p>
        {match.persistenceError && <p className="input-help error" role="alert">{match.persistenceError}</p>}

        <section className="scoreboard total-scoreboard" aria-label="Score and remaining stones">
          <div className={`score total-score ${match.playerColor}`}>
            <span>{leagueGame ? '🇨🇳 You' : 'You'} <ColorBadge color={match.playerColor} /></span>
            <strong>{match.playerScore}</strong>
            <small>{match.playerRemaining} stones left</small>
          </div>
          <div className="versus">VS</div>
          <div className={`score total-score ${match.opponentColor}`}>
            <span>{leagueGame?.opponentName || 'AI'} <ColorBadge color={match.opponentColor} /></span>
            <strong>{match.opponentScore}</strong>
            <small>{match.opponentRemaining} stones left</small>
          </div>
        </section>

        {match.isFinished ? (
          <section className="game-over" aria-live="polite">
            <div className="trophy" aria-hidden="true">{playerWon ? '★' : '◆'}</div>
            <p className="eyebrow">Final score {match.playerScore}–{match.opponentScore}</p>
            <h2>{playerWon ? 'You win!' : 'AI wins'}</h2>
            <p>{playerWon ? 'You managed your stones best.' : 'The AI takes this one. Try a new allocation!'}</p>
            {leagueGame ? <>
              <button className="restart-button" disabled={saving} onClick={() => onComplete({
                redScore: match.playerColor === 'red' ? match.playerScore : match.opponentScore,
                blueScore: match.playerColor === 'blue' ? match.playerScore : match.opponentScore,
              })}>{saving ? 'Saving…' : 'Save result and return to league'}</button>
              {saveError && <p className="input-help error" role="alert">{saveError}</p>}
            </> : <>
              <button className="restart-button" onClick={match.restart}>Play again</button>
              <button className="text-button" onClick={onExit}>Back to game selection</button>
            </>}
          </section>
        ) : (
          <form className="stone-controls" onSubmit={submitPlay}>
            <label htmlFor="stone-amount">Stones to play</label>
            <div className="stone-input-row">
              <input
                id="stone-amount"
                type="number"
                inputMode="numeric"
                min="0"
                max={match.playerRemaining}
                step="1"
                value={match.isFinalRound ? match.playerRemaining : amount}
                disabled={match.isFinalRound}
                onChange={(event) => { setAmount(event.target.value); setError('') }}
                placeholder={`0–${match.playerRemaining}`}
              />
              <button type="submit">{match.isFinalRound ? `Play final ${match.playerRemaining}` : 'Reveal'}</button>
            </div>
            {match.isFinalRound
              ? <p className="input-help">Final round: all remaining stones must be played.</p>
              : <p className={`input-help ${error ? 'error' : ''}`}>{error || `You can play 0 to ${match.playerRemaining} stones.`}</p>}
          </form>
        )}

        <section className="round-history" aria-live="polite">
          <div className="history-heading">
            <div><p className="eyebrow">Game history</p><h2>Past plays</h2></div>
            <span>{match.history.length} / {match.rounds}</span>
          </div>

          {match.history.length === 0 ? (
            <p className="empty-history">Your completed rounds will appear here.</p>
          ) : (
            <div className="history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Round</th>
                    <th scope="col">You <ColorBadge color={match.playerColor} /></th>
                    <th scope="col">AI <ColorBadge color={match.opponentColor} /></th>
                  </tr>
                </thead>
                <tbody>
                  {[...match.history].reverse().map((playedRound, reverseIndex) => {
                    const roundNumber = match.history.length - reverseIndex
                    const playerWon = playedRound.result === 'win'
                    const tieNote = playedRound.tied ? <small>Red wins tie</small> : null
                    return (
                      <tr key={roundNumber} className={reverseIndex === 0 ? 'latest-round' : ''}>
                        <th scope="row">{roundNumber}</th>
                        <td className={playerWon ? 'round-winner' : ''}>
                          <strong>{playedRound.playerStones}</strong>
                          {playerWon && tieNote}
                        </td>
                        <td className={!playerWon ? 'round-winner' : ''}>
                          <strong>{playedRound.opponentStones}</strong>
                          {!playerWon && tieNote}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
