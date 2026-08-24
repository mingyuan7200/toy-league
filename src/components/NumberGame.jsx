import { useNumberMatch } from '../game/useNumberMatch.js'

export function createNumberRange(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

function NumberBoard({ title, description, numbers, remaining, lastPlayed, interactive, onPlay }) {
  return (
    <section className={`number-board ${interactive ? 'player-board' : 'opponent-board'}`}>
      <div className="board-heading">
        <div><h2>{title}</h2><p>{description}</p></div>
        <span>{remaining.length} left</span>
      </div>
      <div className="number-grid">
        {numbers.map((number) => {
          const available = remaining.includes(number)
          const lastClass = number === lastPlayed ? 'last-played' : ''
          return interactive ? (
            <button key={number} className={lastClass} disabled={!available} onClick={() => onPlay(number)} aria-label={available ? `Play number ${number}` : `Number ${number} already played`}>
              {number}
            </button>
          ) : (
            <span key={number} className={`${available ? 'available' : 'used'} ${lastClass}`} aria-label={available ? `Opponent number ${number} is available` : `Opponent used number ${number}`}>
              {number}
            </span>
          )
        })}
      </div>
    </section>
  )
}

export default function NumberGame({
  numbers = createNumberRange(1, 12),
  playerName = 'You',
  opponentName = 'AI',
  gameLabel = 'Number game',
  chooseOpponentNumber,
  onComplete,
  onExit,
}) {
  const match = useNumberMatch({ numbers, chooseOpponentNumber, onComplete })
  const { playerScore, opponentScore, lastRound, isFinished } = match
  const finalMessage = playerScore > opponentScore ? `${playerName} win!` : playerScore < opponentScore ? `${opponentName} wins` : 'It’s a draw!'
  const playerBoardTitle = playerName === 'You' ? 'Your numbers' : `${playerName}’s numbers`

  return (
    <main className="screen game-screen">
      <section className="game-shell">
        <header className="game-header">
          <button className="back-button" onClick={onExit} aria-label="Back to menu">←</button>
          <div><p className="eyebrow">{gameLabel}</p><h1>Round {match.round} <span>/ {numbers.length}</span></h1></div>
          <div className="header-spacer" aria-hidden="true" />
        </header>

        <section className="scoreboard" aria-label="Score">
          <div className="score player-score"><span>{playerName}</span><strong>{playerScore}</strong></div>
          <div className="versus">VS</div>
          <div className="score ai-score"><span>{opponentName}</span><strong>{opponentScore}</strong></div>
        </section>

        {!isFinished && (
          <section className={`round-result ${lastRound?.result ?? ''}`} aria-live="polite">
            {lastRound ? <>
              <div className="played-numbers">
                <span><small>{playerName}</small>{lastRound.playerNumber}</span><b>—</b><span><small>{opponentName}</small>{lastRound.opponentNumber}</span>
              </div>
              <p>{lastRound.result === 'win' ? `Point to ${playerName}!` : lastRound.result === 'loss' ? `Point to ${opponentName}` : 'Same number — draw'}</p>
            </> : <p className="first-prompt">Choose a number to begin</p>}
          </section>
        )}

        {isFinished ? (
          <section className="game-over" aria-live="polite">
            <div className="trophy" aria-hidden="true">{playerScore > opponentScore ? '★' : playerScore < opponentScore ? '◆' : '＝'}</div>
            <p className="eyebrow">Final score {playerScore}–{opponentScore}</p>
            <h2>{finalMessage}</h2>
            <p>{playerScore === opponentScore ? `Perfectly matched over ${numbers.length} rounds.` : playerScore > opponentScore ? 'Great picks. You took the game!' : 'Good game. Ready for another shot?'}</p>
            <button className="restart-button" onClick={match.restart}>Play again</button>
            <button className="text-button" onClick={onExit}>Back to menu</button>
          </section>
        ) : (
          <div className="boards">
            <NumberBoard title={playerBoardTitle} description="Each number can only be played once." numbers={numbers} remaining={match.playerRemaining} lastPlayed={lastRound?.playerNumber} interactive onPlay={match.play} />
            <NumberBoard title={`${opponentName}’s numbers`} description="Watch what your opponent has left." numbers={numbers} remaining={match.opponentRemaining} lastPlayed={lastRound?.opponentNumber} />
          </div>
        )}
      </section>
    </main>
  )
}
