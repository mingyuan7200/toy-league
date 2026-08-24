import { useCallback, useEffect, useRef, useState } from 'react'

const randomChoice = (availableNumbers) => (
  availableNumbers[Math.floor(Math.random() * availableNumbers.length)]
)

function freshMatch(numbers) {
  return {
    playerRemaining: [...numbers],
    opponentRemaining: [...numbers],
    playerScore: 0,
    opponentScore: 0,
    history: [],
  }
}

/** Reusable state engine for a single number match. */
export function useNumberMatch({ numbers, chooseOpponentNumber = randomChoice, onComplete }) {
  const [match, setMatch] = useState(() => freshMatch(numbers))
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const play = useCallback((playerNumber) => {
    setMatch((current) => {
      if (!current.playerRemaining.includes(playerNumber)) return current

      const opponentNumber = chooseOpponentNumber([...current.opponentRemaining], {
        playerNumber,
        history: [...current.history],
      })
      if (!current.opponentRemaining.includes(opponentNumber)) {
        throw new Error('Opponent strategy must choose an available number.')
      }

      const result = playerNumber > opponentNumber ? 'win' : playerNumber < opponentNumber ? 'loss' : 'draw'
      const playerRemaining = current.playerRemaining.filter((number) => number !== playerNumber)
      const opponentRemaining = current.opponentRemaining.filter((number) => number !== opponentNumber)
      const next = {
        playerRemaining,
        opponentRemaining,
        playerScore: current.playerScore + (result === 'win' ? 1 : 0),
        opponentScore: current.opponentScore + (result === 'loss' ? 1 : 0),
        history: [...current.history, { playerNumber, opponentNumber, result }],
      }

      if (playerRemaining.length === 0) queueMicrotask(() => onCompleteRef.current?.(next))
      return next
    })
  }, [chooseOpponentNumber])

  const restart = useCallback(() => setMatch(freshMatch(numbers)), [numbers])

  return {
    ...match,
    lastRound: match.history.at(-1) ?? null,
    round: Math.min(match.history.length + 1, numbers.length),
    isFinished: match.playerRemaining.length === 0,
    play,
    restart,
  }
}
