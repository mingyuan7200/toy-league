export const RULES = { rounds: 15, redStones: 100, blueStones: 112 }

export function allocation(total, rounds = RULES.rounds, random = Math.random) {
  const cuts = [0, ...Array.from({ length: rounds - 1 }, () => Math.floor(random() * (total + 1))).sort((a, b) => a - b), total]
  return cuts.slice(1).map((value, index) => value - cuts[index])
}

export function simulate(random = Math.random) {
  const red = allocation(RULES.redStones, RULES.rounds, random)
  const blue = allocation(RULES.blueStones, RULES.rounds, random)
  const redScore = red.reduce((score, stones, index) => score + Number(stones >= blue[index]), 0)
  return { redScore, blueScore: RULES.rounds - redScore }
}
