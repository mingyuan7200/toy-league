import { useEffect, useState } from 'react'
import { useTotalNumberMatch } from '../game/useTotalNumberMatch.js'

function ColorBadge({ color }) {
  return <span className={`color-badge ${color}`}>{color}</span>
}

export default function TotalNumberGame({ onExit }) {
  const match = useTotalNumberMatch()
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
          <button className="back-button" onClick={onExit} aria-label="Back to game selection">←</button>
          <div><p className="eyebrow">Total Number Game</p><h1>Round {match.round} <span>/ {match.rounds}</span></h1></div>
          <div className="header-spacer" aria-hidden="true" />
        </header>

        <p className="role-summary">{roleSummary}</p>

        <section className="scoreboard total-scoreboard" aria-label="Score and remaining stones">
          <div className={`score total-score ${match.playerColor}`}>
            <span>You <ColorBadge color={match.playerColor} /></span>
            <strong>{match.playerScore}</strong>
            <small>{match.playerRemaining} stones left</small>
          </div>
          <div className="versus">VS</div>
          <div className={`score total-score ${match.opponentColor}`}>
            <span>AI <ColorBadge color={match.opponentColor} /></span>
            <strong>{match.opponentScore}</strong>
            <small>{match.opponentRemaining} stones left</small>
          </div>
        </section>

        {!match.isFinished && (
          <section className={`round-result ${match.lastRound?.result ?? ''}`} aria-live="polite">
            {match.lastRound ? <>
              <div className="played-numbers">
                <span><small>You</small>{match.lastRound.playerStones}</span><b>—</b><span><small>AI</small>{match.lastRound.opponentStones}</span>
              </div>
              <p>
                {match.lastRound.tied
                  ? `Same amount — point to Red (${match.lastRound.result === 'win' ? 'you' : 'AI'})`
                  : match.lastRound.result === 'win' ? 'Point to you!' : 'Point to AI'}
              </p>
            </> : <p className="first-prompt">Choose how many stones to play</p>}
          </section>
        )}

        {match.isFinished ? (
          <section className="game-over" aria-live="polite">
            <div className="trophy" aria-hidden="true">{playerWon ? '★' : '◆'}</div>
            <p className="eyebrow">Final score {match.playerScore}–{match.opponentScore}</p>
            <h2>{playerWon ? 'You win!' : 'AI wins'}</h2>
            <p>{playerWon ? 'You managed your stones best.' : 'The AI takes this one. Try a new allocation!'}</p>
            <button className="restart-button" onClick={match.restart}>Play again</button>
            <button className="text-button" onClick={onExit}>Back to game selection</button>
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
      </section>
    </main>
  )
}
