import { useCallback, useState } from 'react'

const ROUNDS = 15
const RED_STONES = 150
const BLUE_STONES = 162

function randomCutAllocation(total, rounds) {
  const cuts = Array.from(
    { length: rounds - 1 },
    () => Math.floor(Math.random() * (total + 1)),
  ).sort((a, b) => a - b)
  const boundaries = [0, ...cuts, total]
  return boundaries.slice(1).map((boundary, index) => boundary - boundaries[index])
}

function freshMatch() {
  const playerColor = Math.random() < 0.5 ? 'red' : 'blue'
  const opponentColor = playerColor === 'red' ? 'blue' : 'red'
  const playerStones = playerColor === 'red' ? RED_STONES : BLUE_STONES
  const opponentStones = opponentColor === 'red' ? RED_STONES : BLUE_STONES

  return {
    playerColor,
    opponentColor,
    playerRemaining: playerStones,
    opponentRemaining: opponentStones,
    opponentPiles: randomCutAllocation(opponentStones, ROUNDS),
    playerScore: 0,
    opponentScore: 0,
    history: [],
  }
}

export function useTotalNumberMatch() {
  const [match, setMatch] = useState(freshMatch)

  const play = useCallback((requestedStones) => {
    setMatch((current) => {
      if (current.history.length >= ROUNDS) return current

      const isFinalRound = current.history.length === ROUNDS - 1
      const playerStones = isFinalRound ? current.playerRemaining : requestedStones
      if (!Number.isInteger(playerStones) || playerStones < 0 || playerStones > current.playerRemaining) {
        return current
      }

      const opponentStones = current.opponentPiles[current.history.length]
      const tied = playerStones === opponentStones
      const playerWins = playerStones > opponentStones || (tied && current.playerColor === 'red')
      const result = playerWins ? 'win' : 'loss'

      return {
        ...current,
        playerRemaining: current.playerRemaining - playerStones,
        opponentRemaining: current.opponentRemaining - opponentStones,
        playerScore: current.playerScore + (playerWins ? 1 : 0),
        opponentScore: current.opponentScore + (playerWins ? 0 : 1),
        history: [...current.history, { playerStones, opponentStones, tied, result }],
      }
    })
  }, [])

  const restart = useCallback(() => setMatch(freshMatch()), [])
  const isFinished = match.history.length === ROUNDS

  return {
    ...match,
    rounds: ROUNDS,
    round: Math.min(match.history.length + 1, ROUNDS),
    isFinalRound: match.history.length === ROUNDS - 1,
    isFinished,
    lastRound: match.history.at(-1) ?? null,
    play,
    restart,
  }
}
