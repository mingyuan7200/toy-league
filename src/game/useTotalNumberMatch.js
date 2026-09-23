import { useCallback, useEffect, useState } from 'react'
import { allocation } from '../../shared/blotto.js'

const ROUNDS = 15
const RED_STONES = 150
const BLUE_STONES = 162

function freshMatch(options = {}) {
  const playerColor = options.playerColor || (Math.random() < 0.5 ? 'red' : 'blue')
  const opponentColor = playerColor === 'red' ? 'blue' : 'red'
  const redStones = options.redStones ?? RED_STONES
  const blueStones = options.blueStones ?? BLUE_STONES
  const playerStones = playerColor === 'red' ? redStones : blueStones
  const opponentStones = opponentColor === 'red' ? redStones : blueStones

  return {
    playerColor,
    opponentColor,
    playerRemaining: playerStones,
    opponentRemaining: opponentStones,
    opponentPiles: allocation(opponentStones, ROUNDS),
    playerScore: 0,
    opponentScore: 0,
    history: [],
  }
}

export function useTotalNumberMatch(options = {}) {
  const [persistenceError, setPersistenceError] = useState('')
  const [match, setMatch] = useState(() => {
    if (options.storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(options.storageKey))
        if (saved && saved.playerColor === options.playerColor && Array.isArray(saved.history) && saved.history.length <= ROUNDS && saved.opponentPiles?.length === ROUNDS) return saved
      } catch { /* A blocked or damaged local save must not prevent playing. */ }
    }
    return freshMatch(options)
  })

  useEffect(() => {
    if (!options.storageKey) return
    try {
      localStorage.setItem(options.storageKey, JSON.stringify(match))
      setPersistenceError('')
    } catch {
      setPersistenceError('Your browser could not save this unfinished game. Keep this page open until you submit the result.')
    }
  }, [match, options.storageKey])

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

  const restart = () => setMatch(freshMatch(options))
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
    persistenceError,
  }
}
